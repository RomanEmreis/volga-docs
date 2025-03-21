import{_ as s,c as a,a as t,o as e}from"./app-CDshHqXG.js";const p={};function l(c,n){return e(),a("div",null,n[0]||(n[0]=[t(`<h1 id="static-files" tabindex="-1"><a class="header-anchor" href="#static-files"><span>Static Files</span></a></h1><p>Volga supports serving static files with features such as directory browsing, a configurable index file name, path prefixing, a content root folder, and a special fallback file.</p><h2 id="prerequisites" tabindex="-1"><a class="header-anchor" href="#prerequisites"><span>Prerequisites</span></a></h2><h3 id="dependencies" tabindex="-1"><a class="header-anchor" href="#dependencies"><span>Dependencies</span></a></h3><p>If you&#39;re not using the <code>full</code> feature set, you need to enable the <code>static-files</code> feature in your <code>Cargo.toml</code>:</p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.5.2&quot;</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">&quot;static-files&quot;</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="folder-structure" tabindex="-1"><a class="header-anchor" href="#folder-structure"><span>Folder Structure</span></a></h3><p>Let&#39;s assume we have the following folder structure:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">project/</span>
<span class="line">│── static/</span>
<span class="line">│   ├── index.html</span>
<span class="line">│   ├── style.css</span>
<span class="line">│   ├── script.js</span>
<span class="line">│── src/</span>
<span class="line">│   ├── main.rs</span>
<span class="line">│── Cargo.toml</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="basic-static-file-server" tabindex="-1"><a class="header-anchor" href="#basic-static-file-server"><span>Basic Static File Server</span></a></h2><p>After creating <code>html</code>, <code>css</code>, and <code>js</code> files, you can set up a minimal static file server in <code>main.rs</code>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token class-name">App</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_host_env</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>env<span class="token closure-punctuation punctuation">|</span></span> env<span class="token punctuation">.</span><span class="token function">with_content_root</span><span class="token punctuation">(</span><span class="token string">&quot;/static&quot;</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Enables routing to static files</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_static_assets</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>By default, the content root folder is set to the project root (<code>project/</code>). Calling <a href="https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_content_root" target="_blank" rel="noopener noreferrer"><code>with_content_root(&quot;/static&quot;)</code></a> reconfigures it to <code>project/static/</code>.</p><p>Next, calling <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_static_assets" target="_blank" rel="noopener noreferrer"><code>map_static_assets()</code></a> automatically maps all necessary <code>GET</code> and <code>HEAD</code> routes:</p><ul><li><code>/</code> → <code>/index.html</code></li><li><code>/{path}</code> → <code>/any_file_or_folder_in_the_root</code></li></ul><p>If you have subfolders inside the content root, routes to their contents will also be mapped.</p><h2 id="fallback" tabindex="-1"><a class="header-anchor" href="#fallback"><span>Fallback</span></a></h2><p>To serve a custom fallback file (e.g., <code>404.html</code>), use <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file" target="_blank" rel="noopener noreferrer"><code>map_fallback_to_file()</code></a>, which internally calls <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback" target="_blank" rel="noopener noreferrer"><code>map_fallback()</code></a> to handle unknown paths.</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token class-name">App</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_host_env</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>env<span class="token closure-punctuation punctuation">|</span></span> env</span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_content_root</span><span class="token punctuation">(</span><span class="token string">&quot;/static&quot;</span><span class="token punctuation">)</span></span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_fallback_file</span><span class="token punctuation">(</span><span class="token string">&quot;404.html&quot;</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Enables routing to static files</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_static_assets</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Enables fallback to 404.html</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_fallback_to_file</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Since fallback files are disabled by default, we explicitly set the <code>404.html</code> file using <a href="https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_fallback_file" target="_blank" rel="noopener noreferrer"><code>with_fallback_file(&quot;404.html&quot;)</code></a>.</p><p>A more concise version of the above code is:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token class-name">App</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_host_env</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>env<span class="token closure-punctuation punctuation">|</span></span> env</span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_content_root</span><span class="token punctuation">(</span><span class="token string">&quot;/static&quot;</span><span class="token punctuation">)</span></span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_fallback_file</span><span class="token punctuation">(</span><span class="token string">&quot;404.html&quot;</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Enables routing to static files </span></span>
<span class="line">    <span class="token comment">// and fallback to 404.html</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_static_files</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_static_files" target="_blank" rel="noopener noreferrer"><code>use_static_files()</code></a> method combines <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_static_assets" target="_blank" rel="noopener noreferrer"><code>map_static_assets()</code></a> and <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_fallback_to_file" target="_blank" rel="noopener noreferrer"><code>map_fallback_to_file()</code></a>. However, the fallback feature is only enabled if a fallback file is specified.</p><div class="hint-container tip"><p class="hint-container-title">Tips</p><p>You can set <a href="https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_fallback_file" target="_blank" rel="noopener noreferrer"><code>with_fallback_file(&quot;index.html&quot;)</code></a> to always redirect to the main page for unknown routes.</p></div><h2 id="directory-browsing" tabindex="-1"><a class="header-anchor" href="#directory-browsing"><span>Directory Browsing</span></a></h2><p>Like fallback files, directory browsing is disabled by default. You can enable it using <a href="https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html#method.with_files_listing" target="_blank" rel="noopener noreferrer"><code>with_files_listing()</code></a>. However, this is not recommended for production environments.</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token class-name">App</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_host_env</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>env<span class="token closure-punctuation punctuation">|</span></span> env</span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_content_root</span><span class="token punctuation">(</span><span class="token string">&quot;/static&quot;</span><span class="token punctuation">)</span></span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_fallback_file</span><span class="token punctuation">(</span><span class="token string">&quot;404.html&quot;</span><span class="token punctuation">)</span></span>
<span class="line">            <span class="token punctuation">.</span><span class="token function">with_files_listing</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Enables routing to static files </span></span>
<span class="line">    <span class="token comment">// and fallback to 404.html</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_static_files</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="host-environment" tabindex="-1"><a class="header-anchor" href="#host-environment"><span>Host Environment</span></a></h2><p>For more advanced scenarios, you can use the <a href="https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html" target="_blank" rel="noopener noreferrer"><code>HostEnv</code></a> struct, which represents the application&#39;s host environment. Using <code>HostEnv</code> directly makes it easier to switch between environments.</p><p>Here’s how you can achieve the same configuration with <code>HostEnv</code>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">File</span><span class="token punctuation">,</span> <span class="token namespace">app<span class="token punctuation">::</span></span><span class="token class-name">HostEnv</span><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> env <span class="token operator">=</span> <span class="token class-name">HostEnv</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token string">&quot;/static&quot;</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_fallback_file</span><span class="token punctuation">(</span><span class="token string">&quot;404.html&quot;</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_files_listing</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">set_host_env</span><span class="token punctuation">(</span>env<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Enables routing to static files </span></span>
<span class="line">    <span class="token comment">// and fallback to 404.html</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_static_files</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Handles new static file uploads</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_post</span><span class="token punctuation">(</span><span class="token string">&quot;/upload&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>file<span class="token punctuation">:</span> <span class="token class-name">File</span><span class="token punctuation">,</span> env<span class="token punctuation">:</span> <span class="token class-name">HostEnv</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token keyword">let</span> root <span class="token operator">=</span> env<span class="token punctuation">.</span><span class="token function">content_root</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        file<span class="token punctuation">.</span><span class="token function">save</span><span class="token punctuation">(</span>root<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Additionally, <a href="https://docs.rs/volga/latest/volga/app/env/struct.HostEnv.html" target="_blank" rel="noopener noreferrer"><code>HostEnv</code></a> can be extracted in middlewares and request handlers.</p><p>For a full example, see <a href="https://github.com/RomanEmreis/volga/blob/main/examples/static_files.rs" target="_blank" rel="noopener noreferrer">this repository</a>.</p>`,33)]))}const i=s(p,[["render",l],["__file","static-files.html.vue"]]),u=JSON.parse('{"path":"/advanced/static-files.html","title":"Static Files","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Prerequisites","slug":"prerequisites","link":"#prerequisites","children":[{"level":3,"title":"Dependencies","slug":"dependencies","link":"#dependencies","children":[]},{"level":3,"title":"Folder Structure","slug":"folder-structure","link":"#folder-structure","children":[]}]},{"level":2,"title":"Basic Static File Server","slug":"basic-static-file-server","link":"#basic-static-file-server","children":[]},{"level":2,"title":"Fallback","slug":"fallback","link":"#fallback","children":[]},{"level":2,"title":"Directory Browsing","slug":"directory-browsing","link":"#directory-browsing","children":[]},{"level":2,"title":"Host Environment","slug":"host-environment","link":"#host-environment","children":[]}],"git":{"updatedTime":1742551187000},"filePathRelative":"advanced/static-files.md"}');export{i as comp,u as data};
