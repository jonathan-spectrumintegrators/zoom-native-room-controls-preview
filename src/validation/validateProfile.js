import Ajv from 'ajv';
import { schemaState } from './schemaLoader';

let cachedSchema = null;
let cachedValidator = null;

function getValidator() {
    if (cachedSchema === schemaState.schema && cachedValidator) {
        return cachedValidator;
    }
    const ajv = new Ajv({ allErrors: true, jsonPointers: true });
    cachedValidator = ajv.compile(schemaState.schema);
    cachedSchema = schemaState.schema;
    return cachedValidator;
}

function formatPath(dataPath) {
    return dataPath || '(root)';
}

function definitionNameFromSchemaPath(schemaPath) {
    const m = /#\/definitions\/([^/]+)\//.exec(schemaPath || '');
    return m ? m[1] : null;
}

function formatSchemaError(err) {
    const path = formatPath(err.dataPath);
    switch (err.keyword) {
        case 'required':
            return `Missing required field '${err.params.missingProperty}' at ${path}`;
        case 'additionalProperties':
            return `Unknown field '${err.params.additionalProperty}' at ${path}`;
        case 'enum':
            return `${path} must be one of: ${err.params.allowedValues.join(', ')}`;
        case 'pattern': {
            const defName = definitionNameFromSchemaPath(err.schemaPath);
            return defName
                ? `${path} does not match the required format (${defName})`
                : `${path} does not match the required format`;
        }
        case 'type':
            return `${path} must be of type ${err.params.type}`;
        case 'minItems':
            return `${path} must have at least ${err.params.limit} item(s)`;
        case 'maxItems':
            return `${path} must have at most ${err.params.limit} item(s)`;
        case 'minimum':
            return `${path} must be >= ${err.params.limit}`;
        case 'maximum':
            return `${path} must be <= ${err.params.limit}`;
        case 'const':
            return `${path} must equal ${JSON.stringify(err.params.allowedValue)}`;
        case 'not':
            // The schema's only 'not' clause is the action+params conflict
            // (method-level allOf branch). Recognize it by the dataPath shape.
            if (/\/methods\/\d+$/.test(path)) {
                return `${path} has type 'action' but includes 'params'. Use type 'actions' when params are present, or remove 'params' for type 'action'.`;
            }
            return `${path} matched a disallowed pattern`;
        default:
            return `${path} ${err.message}`;
    }
}

function runSchemaValidation(json) {
    const validate = getValidator();
    const ok = validate(json);
    if (ok) return [];
    // Ajv emits a cascade of errors when if/then/anyOf branches fail. The first
    // concrete error is usually the most actionable; the rest are noise from
    // upstream conditional wrappers. Prefer non-'if'/'anyOf' errors when present.
    const errors = validate.errors || [];
    const informative = errors.filter(
        (e) => e.keyword !== 'if' && e.keyword !== 'anyOf' && e.keyword !== 'allOf'
    );
    const chosen = informative.length > 0 ? informative : errors;
    return chosen.map((err) => ({
        source: 'schema',
        path: formatPath(err.dataPath),
        message: formatSchemaError(err),
    }));
}

function findPortMethodParam(json, commandRef) {
    const [portId, methodId, paramId] = commandRef.split('.');
    let foundPort = null;
    let foundAdapter = null;
    if (json.adapters) {
        for (const adapter of json.adapters) {
            if (!adapter.ports) continue;
            const p = adapter.ports.find((pp) => pp.id === portId);
            if (p) {
                foundPort = p;
                foundAdapter = adapter;
                break;
            }
        }
    }
    if (!foundPort) return { error: `unknown port '${portId}'` };
    if (!methodId) return { port: foundPort };

    // iTachIP2CC ports get a 'power' method with on/off params auto-injected by
    // the transform pass. Cross-ref validation runs before that, so we have to
    // recognize the synthetic method here. Returns synthetic objects matching
    // what applyITachIP2CCMethods would produce, so transform's resolveScenes
    // (which also calls this) gets the same shape after methods are injected.
    if (foundAdapter.model === 'iTachIP2CC' && !foundPort.methods) {
        if (methodId !== 'power') {
            return {
                error: `unknown method '${methodId}' on port '${portId}' (iTachIP2CC ports only expose 'power')`,
            };
        }
        const syntheticMethod = { id: 'power', name: 'Power' };
        if (!paramId) return { port: foundPort, method: syntheticMethod };
        if (paramId !== 'on' && paramId !== 'off') {
            return {
                error: `unknown param '${paramId}' on method '${portId}.power' (iTachIP2CC only supports 'on'/'off')`,
            };
        }
        return {
            port: foundPort,
            method: syntheticMethod,
            param: {
                id: paramId,
                name: paramId === 'on' ? 'On' : 'Off',
                position: foundPort.position,
            },
        };
    }

    const method = (foundPort.methods || []).find((m) => m.id === methodId);
    if (!method) {
        return { error: `unknown method '${methodId}' on port '${portId}'` };
    }
    if (!paramId) return { port: foundPort, method };
    const param = (method.params || []).find((p) => p.id === paramId);
    if (!param) {
        return {
            error: `unknown param '${paramId}' on method '${portId}.${methodId}'`,
        };
    }
    return { port: foundPort, method, param };
}

function runCrossRefValidation(json) {
    const errors = [];

    if (Array.isArray(json.scenes)) {
        json.scenes.forEach((scene, i) => {
            if (!Array.isArray(scene.commands)) return;
            scene.commands.forEach((commandRef, j) => {
                const result = findPortMethodParam(json, commandRef);
                if (result.error) {
                    errors.push({
                        source: 'cross-ref',
                        path: `/scenes/${i}/commands/${j}`,
                        message: `Scene '${scene.id}' references ${result.error} in command '${commandRef}'`,
                    });
                }
            });
        });
    }

    if (json.rules && typeof json.rules === 'object') {
        Object.entries(json.rules).forEach(([event, commands]) => {
            if (event === '$comment' || !Array.isArray(commands)) return;
            commands.forEach((commandRef, j) => {
                const result = findPortMethodParam(json, commandRef);
                if (result.error) {
                    errors.push({
                        source: 'cross-ref',
                        path: `/rules/${event}/${j}`,
                        message: `Rule '${event}' references ${result.error} in command '${commandRef}'`,
                    });
                }
            });
        });
    }

    return errors;
}

function runQuirkValidation(rawText, json) {
    const errors = [];

    // Zoom rejects profiles where an empty rule has any whitespace between the
    // brackets. "meeting_started": [] works; "[ ]" or "[\n]" fails to load even
    // though it's valid JSON. We can only catch this from the raw source text.
    if (json.rules && typeof json.rules === 'object') {
        Object.keys(json.rules).forEach((rule) => {
            if (rule === '$comment') return;
            if (Array.isArray(json.rules[rule]) && json.rules[rule].length === 0) {
                const re = new RegExp('"rules"(.|\\n)*"' + rule + '": \\[\\]');
                if (!re.test(rawText)) {
                    errors.push({
                        source: 'quirks',
                        path: `/rules/${rule}`,
                        message:
                            "Empty rules must be truly empty (nothing between the square brackets [])",
                    });
                }
            }
        });
    }

    return errors;
}

export function validateProfile(rawText, json) {
    const schemaErrors = runSchemaValidation(json);
    if (schemaErrors.length > 0) {
        return { ok: false, errors: schemaErrors };
    }

    const crossRefErrors = runCrossRefValidation(json);
    if (crossRefErrors.length > 0) {
        return { ok: false, errors: crossRefErrors };
    }

    const quirkErrors = runQuirkValidation(rawText, json);
    if (quirkErrors.length > 0) {
        return { ok: false, errors: quirkErrors };
    }

    return { ok: true, errors: [] };
}

export { findPortMethodParam };
