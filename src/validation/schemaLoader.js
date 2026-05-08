import { reactive } from 'vue';
import localSchema from '@/schemas/zrcs-profile.schema.json';

const REMOTE_URL =
    'https://raw.githubusercontent.com/SpectrumIntegrators/PublicSchemas/refs/heads/main/ZoomRoomsControlProfile/v1/zrcs-profile.schema.json';
const FETCH_TIMEOUT_MS = 5000;

export const schemaState = reactive({
    schema: localSchema,
    source: 'local',
    version: 0,
});

let started = false;

export function loadRemoteSchema() {
    if (started) return;
    started = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(REMOTE_URL, { signal: controller.signal })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((remote) => {
            schemaState.schema = remote;
            schemaState.source = 'remote';
            schemaState.version += 1;
        })
        .catch((err) => {
            console.warn(
                `[schemaLoader] Falling back to bundled schema: ${err.message}`
            );
        })
        .finally(() => clearTimeout(timeout));
}
