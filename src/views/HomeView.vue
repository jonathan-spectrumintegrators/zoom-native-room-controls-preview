<template>
    <div id="preview-frame">
        <div
            id="json-entry"
            class="split">
            <textarea
                id="json-textarea"
                v-model="json"></textarea>
            <div
                id="zoom-output"
                v-if="target">
                <p class="zoom-output-label">Event:</p>
                <p
                    class="zoom-output-content"
                    id="zoom-output-target">
                    {{ target }}
                </p>
                <p class="zoom-output-label">Command(s):</p>
                <div
                    class="zoom-output-content"
                    id="zoom-output-command">
                    <div
                        v-for="(c, i) in commands"
                        :key="i"
                        class="command-row">
                        <span class="command-address">{{ c.address }}:</span>
                        <pre class="command-text"><span v-for="(seg, j) in splitCommand(c.command)" :key="j" :class="{ ws: seg.ws }">{{ seg.text }}</span></pre>
                    </div>
                </div>
            </div>
        </div>
        <div
            id="preview"
            class="split">
            <div
                id="zoom-controls"
                v-if="calculatedControls != null">
                <div
                    class="scenes-section"
                    v-if="calculatedControls.scenes && calculatedControls.scenes.length > 0">
                    <div class="section-header">
                        <p class="section-label">Scenes</p>
                        <button
                            v-if="calculatedControls.scenes.length > 8"
                            class="btn-collapse"
                            :class="{ expanded: scenesExpanded }"
                            @click="scenesExpanded = !scenesExpanded">
                            <span class="material-icons">keyboard_arrow_down</span>
                        </button>
                    </div>
                    <div class="scenes-grid">
                        <button
                            v-for="scene in visibleScenes"
                            class="btn-scene"
                            @click="sceneClick(scene)">
                            <span
                                v-if="scene.icon && scene.icon.startsWith('mdi:')"
                                :class="getMaterialIconClass(scene.icon)"
                                >{{ getMaterialIconName(scene.icon) }}</span
                            >
                            <img
                                v-else-if="scene.icon"
                                :src="getIconUrl(scene.icon)" />
                            <p>{{ scene.name || scene.id }}</p>
                        </button>
                    </div>
                </div>
                <p class="section-label">Devices</p>
                <template v-for="adapter in calculatedControls.adapters">
                    <div
                        v-for="port in adapter.ports"
                        class="port">
                        <div class="header method">
                            <div class="method-label">
                                <span
                                    v-if="port.icon && port.icon.startsWith('mdi:')"
                                    :class="getMaterialIconClass(port.icon)"
                                    >{{ getMaterialIconName(port.icon) }}</span
                                >

                                <img
                                    v-else-if="port.icon"
                                    :src="getIconUrl(port.icon)" />
                                <p>{{ port.name }}</p>
                            </div>
                            <div v-if="port.main_method">
                                <template v-if="port.main_method.params">
                                    <div class="button-group">
                                        <div
                                            v-for="param in port.main_method.params">
                                            <button
                                                class="btn-zoom"
                                                :class="{
                                                    'btn-rectangle': param.icon == null,
                                                    'btn-circle': param.icon != null,
                                                }"
                                                @click="zoomClick(adapter, port, port.main_method, param)">
                                                <p v-if="!param.icon">
                                                    {{ param.name }}
                                                </p>
                                                <span
                                                    v-else-if="param.icon && param.icon.startsWith('mdi:')"
                                                    :class="getMaterialIconClass(param.icon)"
                                                    >{{ getMaterialIconName(param.icon) }}</span
                                                >
                                                <img
                                                    v-else
                                                    :src="getIconUrl(param.icon)" />
                                            </button>
                                        </div>
                                    </div>
                                </template>
                                <template v-else-if="port.main_method.type != 'actions'">
                                    <button
                                        class="btn-zoom"
                                        :class="{
                                            'btn-rectangle': port.main_method.icon == null,
                                            'btn-circle': port.main_method.icon != null,
                                        }"
                                        @click="zoomClick(adapter, port, port.main_method)">
                                        <p v-if="!port.main_method.icon">
                                            {{ port.main_method.name }}
                                        </p>
                                        <span
                                            v-if="port.main_method.icon && port.main_method.icon.startsWith('mdi:')"
                                            :class="getMaterialIconClass(port.main_method.icon)"
                                            >{{ getMaterialIconName(port.main_method.icon) }}</span
                                        >
                                        <img
                                            v-else
                                            :src="getIconUrl(port.main_method.icon)" />
                                    </button>
                                </template>
                            </div>
                        </div>
                        <template v-if="!port.showOnlyMainMethod">
                            <div class="divider"></div>
                            <template v-for="method in port.methods">
                                <div
                                    v-if="method.visible == true"
                                    class="method">
                                    <div class="method-label">
                                        <span
                                            v-if="method.icon && method.icon.startsWith('mdi:')"
                                            :class="getMaterialIconClass(method.icon)"
                                            >{{ getMaterialIconName(method.icon) }}</span
                                        >
                                        <img
                                            v-else-if="method.icon"
                                            :src="getIconUrl(method.icon)" />
                                        <p>{{ method.name }}</p>
                                    </div>
                                    <div
                                        class="button-group"
                                        v-if="method.params">
                                        <div v-for="param in method.params">
                                            <button
                                                class="btn-zoom"
                                                :class="{
                                                    'btn-rectangle': param.icon == null,
                                                    'btn-circle': param.icon != null,
                                                }"
                                                @click="zoomClick(adapter, port, method, param)">
                                                <p v-if="!param.icon">
                                                    {{ param.name }}
                                                </p>
                                                <span
                                                    v-else-if="param.icon && param.icon.startsWith('mdi:')"
                                                    :class="getMaterialIconClass(param.icon)"
                                                    >{{ getMaterialIconName(param.icon) }}</span
                                                >
                                                <img
                                                    v-else
                                                    :src="getIconUrl(param.icon)" />
                                            </button>
                                        </div>
                                    </div>
                                    <div v-else-if="method.type != 'actions'">
                                        <button
                                            class="btn-zoom"
                                            :class="{
                                                'btn-rectangle': method.icon == null,
                                                'btn-circle': method.icon != null,
                                            }"
                                            @click="zoomClick(adapter, port, method)">
                                            <p v-if="!method.icon">
                                                {{ method.name }}
                                            </p>
                                            <span
                                                v-else-if="method.icon && method.icon.startsWith('mdi:')"
                                                :class="getMaterialIconClass(method.icon)"
                                                >{{ getMaterialIconName(method.icon) }}</span
                                            >
                                            <img
                                                v-else
                                                :src="getIconUrl(method.icon)" />
                                        </button>
                                    </div>
                                </div>
                            </template>
                        </template>
                    </div>
                </template>
            </div>
            <div
                v-else
                id="json-invalid">
                <h1>Error</h1>
                <p>{{ errorMessage }}</p>
            </div>
        </div>
    </div>
</template>

<script>
import exampleJson from '@/assets/example.json';
import { validateProfile } from '@/validation/validateProfile';
import { transformProfile, formatCommand } from '@/validation/transformProfile';
import { schemaState, loadRemoteSchema } from '@/validation/schemaLoader';

export default {
    name: 'HomeView',
    data: () => ({
        json: JSON.stringify(exampleJson, null, 2),
        errorMessage: '',
        target: '',
        commands: [],
        scenesExpanded: false,
    }),
    created() {
        loadRemoteSchema();
    },
    methods: {
        getIconUrl(iconName) {
            var icons = require.context('@/assets/zoom_icons/dark/', true, /\.png$/);

            try {
                return icons('./' + iconName + '.png');
            } catch {
                return icons('./icon_alert.png');
            }
        },
        getMaterialIconName(iconName) {
            if (iconName)
        {
            const parts = iconName.split(':');
            if (parts.length > 1)
            {
                return parts[1];
            }
            else return "";

        }
        },
        getMaterialIconClass(iconName) {
            if (iconName)
        {
            const parts = iconName.split(':');
            if (parts.length > 2) {
                switch (parts[2]) {
                    case 'outlined':
                        return `material-icons-outlined`;
                    case 'rounded':
                        return `material-icons-round`;
                    case 'sharp':
                        return `material-icons-sharp`;
                    case 'two_tone':
                        return `material-icons-two-tone`;
                    case 'filled':
                    default:
                        return `material-icons`;
                }
            } else {
                return `material-icons`
            }
        }
        },
        splitCommand(text) {
            const segments = [];
            let buffer = '';
            for (const ch of text) {
                if (ch === ' ') {
                    if (buffer) {
                        segments.push({ ws: false, text: buffer });
                        buffer = '';
                    }
                    segments.push({ ws: true, text: ' ' });
                } else {
                    buffer += ch;
                }
            }
            if (buffer) segments.push({ ws: false, text: buffer });
            return segments;
        },
        zoomClick(adapter, port, method, param) {
            this.target = param ? `${port.id}.${method.id}.${param.id}` : `${port.id}.${method.id}`;
            this.commands = [formatCommand(adapter, port, method, param)];
        },
        sceneClick(scene) {
            this.target = scene.id;
            this.commands = scene.resolvedCommands;
        },
    },
    computed: {
        exampleJson() {
            return exampleJson;
        },
        visibleScenes() {
            if (!this.calculatedControls || !this.calculatedControls.scenes) return [];
            const scenes = this.calculatedControls.scenes;
            if (this.scenesExpanded || scenes.length <= 8) return scenes;
            return scenes.slice(0, 8);
        },
        calculatedControls() {
            // Read schemaState.version so this re-runs when the remote schema arrives.
            schemaState.version;

            let json;
            try {
                json = JSON.parse(this.json);
            } catch {
                this.errorMessage = 'JSON Parsing Failed';
                return null;
            }

            const result = validateProfile(this.json, json);
            if (!result.ok) {
                this.errorMessage = result.errors[0].message;
                return null;
            }

            return transformProfile(json);
        },
    },
};
</script>

<style lang="scss">
$zoom-panel-width: 666px;
$zoom-button-height: 58px;

#preview-frame {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    height: 100%;
    gap: 1rem;

    .split {
        height: 100%;
        flex: 1;
    }

    #json-entry {
        display: flex;
        flex-direction: column;
        gap: 1rem;

        textarea {
            flex: 1;
            border: 1px solid $color-border;
        }

        #zoom-output {
            border: 1px solid $color-border;
            background: #fff;
            display: grid;
            grid-template-columns: min-content auto;

            .zoom-output-label {
                font-weight: bold;
                font-size: 1rem;
            }

            .zoom-output-content {
                text-align: left;
                width: 100%;
                font-size: 1rem;
                white-space: pre-wrap;
                max-height: 200px;
                overflow-y: auto;
                margin: 0;
                font-family: inherit;
            }

            #zoom-output-command {
                display: flex;
                flex-direction: column;
                gap: 0.3rem;

                .command-row {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 0.4rem;
                    flex-wrap: wrap;
                }

                .command-address {
                    font-family: inherit;
                }

                .command-text {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace;
                    background: #f4f4f5;
                    border: 1px solid $color-border;
                    border-radius: 4px;
                    padding: 0.2rem 0.5rem;
                    margin: 0;
                    white-space: pre-wrap;

                    .ws {
                        background-image: radial-gradient(
                            circle at center,
                            rgba(0, 0, 0, 0.35) 1px,
                            transparent 1.5px
                        );
                        background-repeat: no-repeat;
                        background-position: center;
                    }
                }
            }
        }
    }
    #preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        overflow: auto;

        #json-invalid {
            width: 100%;
            background: $color-error;
            color: $color-text-light;
            text-align: center;
            padding: 1rem;

            h1 {
                font-size: 1.5rem;
            }
        }

        #zoom-controls {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 1rem;
            width: $zoom-panel-width;

            .section-label {
                font-size: 16px;
                font-weight: 500;
                color: $color-text-dark;
                opacity: 0.7;
                margin-left: 4px;
            }

            .scenes-section {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;

                .section-header {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    padding-right: 4px;
                }

                .btn-collapse {
                    @extend %btn-shared;

                    border: 1px solid $color-border;
                    border-radius: 50%;
                    background: transparent;
                    color: $color-text-dark;
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    line-height: 1;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    .material-icons {
                        font-size: 20px;
                        transition: transform 0.15s ease-in-out;
                    }

                    &.expanded .material-icons {
                        transform: rotate(180deg);
                    }
                }

                .scenes-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .btn-scene {
                    @extend %btn-shared;

                    border: none;
                    border-radius: 10px;
                    background: $color-zoom-port-background;
                    color: $color-text-dark;
                    font-size: 19px;
                    font-weight: bold;
                    padding: 22px 30px;
                    min-height: $zoom-button-height;
                    text-align: left;

                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 1rem;

                    p {
                        white-space: normal;
                        overflow-wrap: anywhere;
                    }

                    &:active {
                        background: darken($color-zoom-port-background, 5);
                    }
                }
            }

            .port {
                border-radius: 10px;
                background: $color-zoom-port-background;
                padding: 0px 30px;
                font-size: 19px;
                width: 100%;

                .header {
                    font-weight: bold;
                }

                .divider {
                    height: 1px;
                    background: $color-zoom-button;
                }

                .method {
                    padding: 22px 0px;
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .method-label {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    white-space: nowrap;
                    height: $zoom-button-height;
                }

                .button-group {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .btn-zoom {
                    @extend %btn-shared;

                    // Border
                    border: none;

                    // Text
                    font-size: 20px;

                    // Colors
                    background-color: $color-zoom-button;
                    color: $color-text-dark;

                    &:active {
                        background: darken($color-zoom-button, 10);
                    }

                    &.btn-circle {
                        // Border
                        border-radius: 50%;

                        // Size
                        padding: 0px;
                        width: $zoom-button-height;
                        height: $zoom-button-height;

                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    &.btn-rectangle {
                        // Border
                        border-radius: 12px;

                        // Size
                        padding: 0 22px;
                        min-width: 93px;
                        height: $zoom-button-height;
                    }
                }
            }
        }
    }
}
</style>
