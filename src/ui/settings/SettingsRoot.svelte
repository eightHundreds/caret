<script>
    import { Notice } from "obsidian";
    import { onMount } from "svelte";
    import { DEFAULT_MODEL_META, ensureModelSettings } from "../../config/llm-provider-registry";

    export let plugin;

    let activeTab = "model";
    let settings = plugin.settings;
    let editingId = null;
    let draft = null;

    onMount(() => {
        refreshSettings();
    });

    function refreshSettings() {
        settings = plugin.settings;
        ensureModelSettings(settings);
        cloneSettings();
    }

    function cloneSettings() {
        settings = {
            ...settings,
            custom_endpoints: { ...settings.custom_endpoints },
        };
    }

    function uniqueId(base) {
        let candidate = base;
        let idx = 1;
        while (settings.custom_endpoints[candidate]) {
            candidate = `${base}-${idx++}`;
        }
        return candidate;
    }

    function sortedModels() {
        const entries = Object.entries(settings.custom_endpoints || {});
        const defaultId = settings.model;
        return entries.sort(([aId, aVal], [bId, bVal]) => {
            if (aId === defaultId) return -1;
            if (bId === defaultId) return 1;
            if (aVal.pinned && !bVal.pinned) return -1;
            if (!aVal.pinned && bVal.pinned) return 1;
            return (aVal.name || aId).localeCompare(bVal.name || bId);
        });
    }

    $: modelsList = sortedModels();
    $: defaultModel = settings.custom_endpoints[settings.model] || { ...DEFAULT_MODEL_META, endpoint: "", api_key: "" };

    function updateModel(modelId, partial) {
        const current = settings.custom_endpoints[modelId] || { ...DEFAULT_MODEL_META, endpoint: "", api_key: "" };
        settings.custom_endpoints[modelId] = { ...current, ...partial };
        cloneSettings();
    }

    function renameDefaultModel(newId) {
        const trimmed = newId.trim();
        if (!trimmed || trimmed === settings.model) return;
        if (settings.custom_endpoints[trimmed]) {
            new Notice("模型 ID 已存在");
            return;
        }
        const current = settings.custom_endpoints[settings.model];
        delete settings.custom_endpoints[settings.model];
        settings.custom_endpoints[trimmed] = { ...current, name: current.name || trimmed };
        settings.model = trimmed;
        cloneSettings();
    }

    async function save(targetTab) {
        ensureModelSettings(settings);
        plugin.settings = settings;
        await plugin.saveSettings();
        await plugin.loadSettings();
        refreshSettings();
        if (targetTab) activeTab = targetTab;
    }

    async function setDefaultModel(modelId) {
        settings.model = modelId;
        const modelConfig = settings.custom_endpoints[modelId];
        if (modelConfig?.context_window) {
            settings.context_window = modelConfig.context_window;
        }
        settings.custom_endpoints[modelId].last_used = Date.now();
        cloneSettings();
        await save("library");
    }

    async function togglePinned(modelId) {
        const model = settings.custom_endpoints[modelId];
        model.pinned = !model.pinned;
        cloneSettings();
        await save("library");
    }

    async function addModel() {
        const newId = uniqueId("custom-model");
        settings.custom_endpoints[newId] = {
            ...DEFAULT_MODEL_META,
            name: "新模型",
            endpoint: "",
            api_key: "",
            pinned: false,
            streaming: true,
            function_calling: true,
            vision: true,
        };
        cloneSettings();
        await save("library");
    }

    async function copyModel(modelId) {
        const model = settings.custom_endpoints[modelId];
        const newId = uniqueId(`${modelId}-copy`);
        settings.custom_endpoints[newId] = { ...model, name: `${model.name || modelId} (副本)`, pinned: false };
        cloneSettings();
        await save("library");
    }

    async function deleteModel(modelId) {
        const total = Object.keys(settings.custom_endpoints).length;
        if (total <= 1) {
            new Notice("至少保留一个模型配置");
            return;
        }
        delete settings.custom_endpoints[modelId];
        if (settings.model === modelId) {
            const first = Object.keys(settings.custom_endpoints)[0];
            settings.model = first;
            const ctx = settings.custom_endpoints[first]?.context_window;
            if (ctx) settings.context_window = ctx;
        }
        cloneSettings();
        await save("library");
    }

    function startEdit(modelId, model) {
        editingId = modelId;
        draft = { ...model, id: modelId };
    }

    function cancelEdit() {
        editingId = null;
        draft = null;
    }

    async function saveDraft() {
        if (!draft) return;
        const targetId = draft.id.trim();
        if (!targetId) {
            new Notice("模型 ID 不能为空");
            return;
        }
        if (!draft.endpoint.trim()) {
            new Notice("Endpoint 不能为空");
            return;
        }
        if (!draft.api_key.trim()) {
            new Notice("API key 不能为空");
            return;
        }
        if (targetId !== editingId && settings.custom_endpoints[targetId]) {
            new Notice("模型 ID 已存在");
            return;
        }

        const sourceModel = editingId ? settings.custom_endpoints[editingId] : undefined;
        if (editingId && settings.custom_endpoints[editingId]) {
            delete settings.custom_endpoints[editingId];
        }
        settings.custom_endpoints[targetId] = {
            ...DEFAULT_MODEL_META,
            ...sourceModel,
            ...draft,
            name: draft.name || targetId,
            endpoint: draft.endpoint.trim(),
            api_key: draft.api_key.trim(),
        };
        if (settings.model === editingId) {
            settings.model = targetId;
            settings.context_window = draft.context_window || settings.context_window;
        }

        editingId = null;
        draft = null;
        cloneSettings();
        await save("library");
    }

    function syncContextWindowFromDefault() {
        const ctx = defaultModel?.context_window || settings.context_window;
        settings.context_window = ctx;
        cloneSettings();
    }

    function setTab(tab) {
        activeTab = tab;
    }
</script>

<div class="vertical-tab-layout caret-settings">
    <div class="vertical-tab-header">
        <div class="vertical-tab-nav-item {activeTab === 'model' ? 'is-active' : ''}" on:click={() => setTab("model")}>模型与生成</div>
        <div class="vertical-tab-nav-item {activeTab === 'library' ? 'is-active' : ''}" on:click={() => setTab("library")}>模型库</div>
        <div class="vertical-tab-nav-item {activeTab === 'chat' ? 'is-active' : ''}" on:click={() => setTab("chat")}>聊天与日志</div>
    </div>

    <div class="vertical-tab-content">
        {#if activeTab === "model"}
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">切换默认模型</div>
                    <div class="setting-item-description">仅支持 OpenAI 兼容接口：提供 endpoint、API key、模型能力。</div>
                </div>
                <div class="setting-item-control">
                    <select bind:value={settings.model} on:change={(e) => setDefaultModel(e.target.value)}>
                        {#each modelsList as [id, model]}
                            <option value={id}>{model.name || id}</option>
                        {/each}
                    </select>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">模型名称</div>
                    <div class="setting-item-description">显示名称，可随时调整。</div>
                </div>
                <div class="setting-item-control">
                    <input type="text" value={defaultModel?.name || settings.model} on:input={(e) => updateModel(settings.model, { name: e.target.value })} />
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">模型 ID</div>
                    <div class="setting-item-description">发送到接口的模型标识，修改会同步默认模型。</div>
                </div>
                <div class="setting-item-control">
                    <input type="text" value={settings.model} on:input={(e) => renameDefaultModel(e.target.value)} placeholder="发送到接口的模型标识" />
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">Endpoint</div>
                    <div class="setting-item-description">例如 https://api.your-llm.com/v1</div>
                </div>
                <div class="setting-item-control">
                    <input type="text" value={defaultModel?.endpoint || ""} on:input={(e) => updateModel(settings.model, { endpoint: e.target.value.trim() })} placeholder="https://api.your-llm.com/v1" />
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">API key</div>
                    <div class="setting-item-description">会保存在本地设置中。</div>
                </div>
                <div class="setting-item-control">
                    <input type="password" value={defaultModel?.api_key || ""} on:input={(e) => updateModel(settings.model, { api_key: e.target.value.trim() })} placeholder="sk-..." />
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">上下文窗口</div>
                    <div class="setting-item-description">空值时沿用全局上下文窗口。</div>
                </div>
                <div class="setting-item-control">
                    <input
                        type="number"
                        value={defaultModel?.context_window || settings.context_window}
                        on:input={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            if (!isNaN(parsed)) {
                                updateModel(settings.model, { context_window: parsed });
                                settings.context_window = parsed;
                                cloneSettings();
                            }
                        }}
                    />
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">流式输出</div>
                    <div class="setting-item-description">开启后支持流式消息。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" checked={defaultModel?.streaming ?? true} on:change={(e) => updateModel(settings.model, { streaming: e.target.checked })} />
                    </div>
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">工具调用</div>
                    <div class="setting-item-description">允许函数调用。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" checked={defaultModel?.function_calling ?? true} on:change={(e) => updateModel(settings.model, { function_calling: e.target.checked })} />
                    </div>
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">视觉/多模态</div>
                    <div class="setting-item-description">开启后允许图片输入。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" checked={defaultModel?.vision ?? true} on:change={(e) => updateModel(settings.model, { vision: e.target.checked })} />
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">操作</div>
                    <div class="setting-item-description">同步上下文后请保存。</div>
                </div>
                <div class="setting-item-control caret-setting-actions">
                    <button on:click={syncContextWindowFromDefault}>同步上下文到全局</button>
                    <button class="mod-cta" on:click={() => save("model")}>保存模型设置</button>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">图像生成</div>
                    <div class="setting-item-description">选择提供商与模型。</div>
                </div>
                <div class="setting-item-control caret-setting-control-stack">
                    <select
                        bind:value={settings.image_provider}
                        on:change={(e) => {
                            const provider = e.target.value;
                            settings.image_provider = provider;
                            const firstModel = Object.keys(settings.image_model_options[provider] || {})[0];
                            if (firstModel) {
                                settings.image_model = firstModel;
                            }
                            cloneSettings();
                        }}>
                        {#each Object.entries(settings.image_provider_dropdown_options) as [key, label]}
                            <option value={key}>{label}</option>
                        {/each}
                    </select>
                    <select bind:value={settings.image_model} on:change={() => cloneSettings()}>
                        {#if settings.image_model_options[settings.image_provider]}
                            {#each Object.entries(settings.image_model_options[settings.image_provider]) as [key, value]}
                                <option value={key}>{value.name}</option>
                            {/each}
                        {/if}
                    </select>
                    <div class="caret-setting-actions">
                        <button class="mod-cta" on:click={() => save("model")}>保存图片设置</button>
                    </div>
                </div>
            </div>
        {/if}

        {#if activeTab === "library"}
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">选择默认模型</div>
                    <div class="setting-item-description">用于聊天与生成的默认模型。</div>
                </div>
                <div class="setting-item-control">
                    <select bind:value={settings.model} on:change={(e) => setDefaultModel(e.target.value)}>
                        {#each modelsList as [id, model]}
                            <option value={id}>{model.name || id}</option>
                        {/each}
                    </select>
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">置顶当前模型</div>
                    <div class="setting-item-description">在列表顶部固定默认模型。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" checked={settings.custom_endpoints[settings.model]?.pinned ?? false} on:change={(e) => {
                            settings.custom_endpoints[settings.model].pinned = e.target.checked;
                            cloneSettings();
                            save("library");
                        }} />
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">模型库</div>
                    <div class="setting-item-description">管理自定义模型、能力与密钥。</div>
                </div>
                <div class="setting-item-control">
                    <button class="mod-cta" on:click={addModel}>新增模型</button>
                </div>
            </div>
            {#each modelsList as [modelId, model]}
                <div class="setting-item caret-model-row">
                    <div class="setting-item-info">
                        <div class="setting-item-name">{model.name || modelId}</div>
                        <div class="setting-item-description">
                            <div class="caret-model-meta">
                                <span>ID: {modelId}</span>
                                <span>
                                    {#if model.streaming || model.function_calling || model.vision}
                                        {[model.streaming ? "流式" : null, model.function_calling ? "工具" : null, model.vision ? "视觉" : null]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    {:else}
                                        无能力标签
                                    {/if}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="setting-item-control caret-setting-actions">
                        <button class={modelId === settings.model ? "mod-cta" : ""} on:click={() => setDefaultModel(modelId)}>
                            {modelId === settings.model ? "当前默认" : "设为默认"}
                        </button>
                        <button on:click={() => togglePinned(modelId)}>{model.pinned ? "取消置顶" : "置顶"}</button>
                        <button on:click={() => copyModel(modelId)}>复制</button>
                        <button class="mod-warning" on:click={() => deleteModel(modelId)}>删除</button>
                        <button on:click={() => startEdit(modelId, model)}>{editingId === modelId ? "编辑中" : "编辑"}</button>
                    </div>
                </div>
                {#if editingId === modelId && draft}
                    <div class="setting-item mod-nested">
                        <div class="setting-item-info">
                            <div class="setting-item-name">编辑 {model.name || modelId}</div>
                            <div class="setting-item-description">修改后点击保存应用。</div>
                        </div>
                        <div class="setting-item-control caret-setting-control-stack">
                            <input type="text" bind:value={draft.name} placeholder="模型名称" />
                            <input type="text" bind:value={draft.id} placeholder="模型 ID" />
                            <input type="text" bind:value={draft.endpoint} placeholder="https://api.your-llm.com/v1" />
                            <input type="password" bind:value={draft.api_key} placeholder="sk-..." />
                            <input type="number" bind:value={draft.context_window} placeholder="上下文窗口" />
                            <div class="caret-toggle-inline">
                                <div class="checkbox-container">
                                    <input type="checkbox" bind:checked={draft.streaming} />
                                </div>
                                <span>流式输出</span>
                            </div>
                            <div class="caret-toggle-inline">
                                <div class="checkbox-container">
                                    <input type="checkbox" bind:checked={draft.function_calling} />
                                </div>
                                <span>工具调用</span>
                            </div>
                            <div class="caret-toggle-inline">
                                <div class="checkbox-container">
                                    <input type="checkbox" bind:checked={draft.vision} />
                                </div>
                                <span>视觉/多模态</span>
                            </div>
                            <div class="caret-toggle-inline">
                                <div class="checkbox-container">
                                    <input type="checkbox" bind:checked={draft.pinned} />
                                </div>
                                <span>置顶</span>
                            </div>
                            <div class="caret-setting-actions">
                                <button class="mod-cta" on:click={saveDraft}>保存</button>
                                <button on:click={cancelEdit}>取消</button>
                            </div>
                        </div>
                    </div>
                {/if}
            {/each}
        {/if}

        {#if activeTab === "chat"}
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">Chat folder path</div>
                    <div class="setting-item-description">管理聊天记录存放路径与命名方式。</div>
                </div>
                <div class="setting-item-control">
                    <input type="text" bind:value={settings.chat_logs_folder} placeholder="caret/chats" />
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">按日期创建子文件夹</div>
                    <div class="setting-item-description">使用日期格式为日志分组。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" bind:checked={settings.chat_logs_date_format_bool} />
                    </div>
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">自动重命名聊天</div>
                    <div class="setting-item-description">根据对话内容生成标题。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" bind:checked={settings.chat_logs_rename_bool} />
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-info">
                    <div class="setting-item-name">发送快捷键</div>
                    <div class="setting-item-description">选择发送消息的快捷键。</div>
                </div>
                <div class="setting-item-control">
                    <select bind:value={settings.chat_send_chat_shortcut}>
                        <option value="enter">Enter</option>
                        <option value="shift_enter">Shift + Enter</option>
                    </select>
                </div>
            </div>
            <div class="setting-item mod-toggle">
                <div class="setting-item-info">
                    <div class="setting-item-name">展开嵌套 [[]] 内容</div>
                    <div class="setting-item-description">包含嵌套引用的文本。</div>
                </div>
                <div class="setting-item-control">
                    <div class="checkbox-container">
                        <input type="checkbox" bind:checked={settings.include_nested_block_refs} />
                    </div>
                </div>
            </div>
            <div class="setting-item">
                <div class="setting-item-control caret-setting-actions">
                    <button class="mod-cta" on:click={() => save("chat")}>保存聊天/日志设置</button>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .caret-settings {
        min-height: 100%;
    }
    .caret-settings .vertical-tab-header {
        min-width: calc(var(--size-4-4) * 11);
        display: flex;
        max-width: 100%;
    }
    .caret-settings .vertical-tab-content {
        display: flex;
        flex-direction: column;
        gap: var(--size-4-2);
        padding-left: var(--size-4-4);
        width: 100%;
    }
    .caret-setting-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--size-4-2);
        justify-content: flex-end;
    }
    .caret-setting-control-stack {
        display: flex;
        flex-direction: column;
        gap: var(--size-4-2);
        align-items: stretch;
        width: 100%;
    }
    .caret-model-row .setting-item-info {
        gap: var(--size-4-1);
    }
    .caret-model-meta {
        display: flex;
        gap: var(--size-4-3);
        flex-wrap: wrap;
        color: var(--text-muted);
    }
    .setting-item.mod-nested {
        margin-left: var(--size-4-5);
        border: var(--border-width) solid var(--background-modifier-border);
        border-radius: var(--radius-l);
        padding: var(--size-4-2) var(--size-4-3);
        background: var(--background-primary);
    }
    .caret-toggle-inline {
        display: flex;
        align-items: center;
        gap: var(--size-4-2);
    }
    .setting-item-control select,
    .setting-item-control input {
        width: 100%;
    }
    .caret-setting-actions button {
        border-radius: var(--button-radius);
    }
</style>
