import{_ as s,c as a,a as e,o as t}from"./app-CDshHqXG.js";const p={};function o(c,n){return t(),a("div",null,n[0]||(n[0]=[e(`<h1 id="dependency-injection" tabindex="-1"><a class="header-anchor" href="#dependency-injection"><span>Dependency Injection</span></a></h1><p>Volga supports robust dependency injection (DI) with three lifetimes: <strong>Singleton</strong>, <strong>Scoped</strong>, and <strong>Transient</strong>. These lifetimes allow you to manage the lifecycle of your dependencies effectively.</p><p>If you&#39;re not using the <code>full</code> feature set, ensure you enable the <code>di</code> feature in your <code>Cargo.toml</code>:</p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.4.5&quot;</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">&quot;di&quot;</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="dependency-lifetimes" tabindex="-1"><a class="header-anchor" href="#dependency-lifetimes"><span>Dependency Lifetimes</span></a></h2><h3 id="singleton" tabindex="-1"><a class="header-anchor" href="#singleton"><span>Singleton</span></a></h3><p>A <strong>Singleton</strong> ensures a single instance of a dependency is created and shared for the entire lifetime of your web application. This instance is thread-safe and reused concurrently across threads.</p><h4 id="example-singleton-dependency" tabindex="-1"><a class="header-anchor" href="#example-singleton-dependency"><span>Example: Singleton Dependency</span></a></h4><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token namespace">di<span class="token punctuation">::</span></span><span class="token class-name">Dc</span><span class="token punctuation">,</span> ok<span class="token punctuation">,</span> not_found<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">std<span class="token punctuation">::</span></span><span class="token punctuation">{</span></span>
<span class="line">    <span class="token namespace">collections<span class="token punctuation">::</span></span><span class="token class-name">HashMap</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token namespace">sync<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">Arc</span><span class="token punctuation">,</span> <span class="token class-name">Mutex</span><span class="token punctuation">}</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[derive(Clone, Default)]</span></span>
<span class="line"><span class="token keyword">struct</span> <span class="token type-definition class-name">InMemoryCache</span> <span class="token punctuation">{</span></span>
<span class="line">    inner<span class="token punctuation">:</span> <span class="token class-name">Arc</span><span class="token operator">&lt;</span><span class="token class-name">Mutex</span><span class="token operator">&lt;</span><span class="token class-name">HashMap</span><span class="token operator">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token operator">&gt;&gt;</span><span class="token operator">&gt;</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Register a singleton service globally</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">add_singleton</span><span class="token punctuation">(</span><span class="token class-name">InMemoryCache</span><span class="token punctuation">::</span><span class="token function">default</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Inject the shared cache instance into the route handlers</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/user/{id}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>id<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> cache<span class="token punctuation">:</span> <span class="token class-name">Dc</span><span class="token operator">&lt;</span><span class="token class-name">InMemoryCache</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token keyword">let</span> user <span class="token operator">=</span> cache<span class="token punctuation">.</span>inner<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">unwrap</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token operator">&amp;</span>id<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token keyword">match</span> user <span class="token punctuation">{</span></span>
<span class="line">            <span class="token class-name">Some</span><span class="token punctuation">(</span>user<span class="token punctuation">)</span> <span class="token operator">=&gt;</span> <span class="token macro property">ok!</span><span class="token punctuation">(</span>user<span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line">            <span class="token class-name">None</span> <span class="token operator">=&gt;</span> <span class="token macro property">not_found!</span><span class="token punctuation">(</span><span class="token string">&quot;User not found&quot;</span><span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line">        <span class="token punctuation">}</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_post</span><span class="token punctuation">(</span><span class="token string">&quot;/user/{id}/{name}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>id<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> cache<span class="token punctuation">:</span> <span class="token class-name">Dc</span><span class="token operator">&lt;</span><span class="token class-name">InMemoryCache</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        cache<span class="token punctuation">.</span>inner<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">unwrap</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">insert</span><span class="token punctuation">(</span>id<span class="token punctuation">,</span> name<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>In this example:</p><ul><li>The <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_singleton" target="_blank" rel="noopener noreferrer"><code>add_singleton</code></a> method registers an <code>InMemoryCache</code> instance as a singleton.</li><li>The <a href="https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html" target="_blank" rel="noopener noreferrer"><code>Dc&lt;T&gt;</code></a> extractor provides access to the dependency container, resolving the dependency as needed.</li><li>The <a href="https://docs.rs/volga/latest/volga/di/dc/struct.Dc.html" target="_blank" rel="noopener noreferrer"><code>Dc&lt;T&gt;</code></a> behaves similarly to other Volga extractors, such as <a href="https://docs.rs/volga/latest/volga/http/endpoints/args/json/struct.Json.html" target="_blank" rel="noopener noreferrer"><code>Json&lt;T&gt;</code></a> or <a href="https://docs.rs/volga/latest/volga/http/endpoints/args/query/struct.Query.html" target="_blank" rel="noopener noreferrer"><code>Query&lt;T&gt;</code></a>.</li></ul><div class="hint-container info"><p class="hint-container-title">Info</p><p><code>T</code> must <a href="https://doc.rust-lang.org/std/marker/trait.Send.html" target="_blank" rel="noopener noreferrer"><code>Send</code></a>, <a href="https://doc.rust-lang.org/std/marker/trait.Sync.html" target="_blank" rel="noopener noreferrer"><code>Sync</code></a> and <a href="https://doc.rust-lang.org/std/default/trait.Default.html" target="_blank" rel="noopener noreferrer"><code>Default</code></a> if it doesn&#39;t depend on anything or if we&#39;re using an already created instance.</p></div><h3 id="scoped" tabindex="-1"><a class="header-anchor" href="#scoped"><span>Scoped</span></a></h3><p>A <strong>Scoped</strong> dependency creates a new instance for each HTTP request. The instance persists for the duration of the request, ensuring isolation between requests.</p><h4 id="example-scoped-dependency" tabindex="-1"><a class="header-anchor" href="#example-scoped-dependency"><span>Example: Scoped Dependency</span></a></h4><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token namespace">di<span class="token punctuation">::</span></span><span class="token class-name">Dc</span><span class="token punctuation">,</span> ok<span class="token punctuation">,</span> not_found<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">std<span class="token punctuation">::</span></span><span class="token punctuation">{</span></span>
<span class="line">    <span class="token namespace">collections<span class="token punctuation">::</span></span><span class="token class-name">HashMap</span><span class="token punctuation">,</span></span>
<span class="line">    <span class="token namespace">sync<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">Arc</span><span class="token punctuation">,</span> <span class="token class-name">Mutex</span><span class="token punctuation">}</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[derive(Clone, Default)]</span></span>
<span class="line"><span class="token keyword">struct</span> <span class="token type-definition class-name">InMemoryCache</span> <span class="token punctuation">{</span></span>
<span class="line">    inner<span class="token punctuation">:</span> <span class="token class-name">Arc</span><span class="token operator">&lt;</span><span class="token class-name">Mutex</span><span class="token operator">&lt;</span><span class="token class-name">HashMap</span><span class="token operator">&lt;</span><span class="token class-name">String</span><span class="token punctuation">,</span> <span class="token class-name">String</span><span class="token operator">&gt;&gt;</span><span class="token operator">&gt;</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Register a scoped service</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">add_scoped</span><span class="token punctuation">::</span><span class="token operator">&lt;</span><span class="token class-name">InMemoryCache</span><span class="token operator">&gt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Inject a request-specific cache instance</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/user/{id}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>id<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> cache<span class="token punctuation">:</span> <span class="token class-name">Dc</span><span class="token operator">&lt;</span><span class="token class-name">InMemoryCache</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token keyword">let</span> user <span class="token operator">=</span> cache<span class="token punctuation">.</span>inner<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">unwrap</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">get</span><span class="token punctuation">(</span><span class="token operator">&amp;</span>id<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token keyword">match</span> user <span class="token punctuation">{</span></span>
<span class="line">            <span class="token class-name">Some</span><span class="token punctuation">(</span>user<span class="token punctuation">)</span> <span class="token operator">=&gt;</span> <span class="token macro property">ok!</span><span class="token punctuation">(</span>user<span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line">            <span class="token class-name">None</span> <span class="token operator">=&gt;</span> <span class="token macro property">not_found!</span><span class="token punctuation">(</span><span class="token string">&quot;User not found&quot;</span><span class="token punctuation">)</span><span class="token punctuation">,</span></span>
<span class="line">        <span class="token punctuation">}</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_post</span><span class="token punctuation">(</span><span class="token string">&quot;/user/{id}/{name}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>id<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> cache<span class="token punctuation">:</span> <span class="token class-name">Dc</span><span class="token operator">&lt;</span><span class="token class-name">InMemoryCache</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        cache<span class="token punctuation">.</span>inner<span class="token punctuation">.</span><span class="token function">lock</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">unwrap</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">insert</span><span class="token punctuation">(</span>id<span class="token punctuation">,</span> name<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Key differences from Singleton:</p><ul><li>The <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_scoped" target="_blank" rel="noopener noreferrer"><code>add_scoped::&lt;T&gt;()</code></a> method registers a dependency that is instantiated lazily for each request.</li><li>Each request gets its own, unique instance of <code>InMemoryCache</code>.</li></ul><h3 id="transient" tabindex="-1"><a class="header-anchor" href="#transient"><span>Transient</span></a></h3><p>A <strong>Transient</strong> dependency creates a new instance whenever requested, regardless of the request or context. You can register a transient service using the <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.add_transient" target="_blank" rel="noopener noreferrer"><code>add_transient::&lt;T&gt;()</code></a> method. The behavior is similar to Scoped, but a new instance is created on every injection request.</p><div class="hint-container tip"><p class="hint-container-title">Tips</p><p>By implementing <a href="https://doc.rust-lang.org/std/default/trait.Default.html" target="_blank" rel="noopener noreferrer"><code>Default</code></a> manually, you can control the instantiation behavior for <strong>Scoped</strong> and <strong>Transient</strong> services. For the more advanced scenarios, especially when you need to construct your service by injecting other dependencies you need to use the <a href="https://docs.rs/volga/latest/volga/di/inject/trait.Inject.html" target="_blank" rel="noopener noreferrer"><code>Inject</code></a> trait.</p></div><h2 id="di-in-middleware" tabindex="-1"><a class="header-anchor" href="#di-in-middleware"><span>DI in middleware</span></a></h2><p>If you need to request a dependency in middleware, use either <a href="https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve" target="_blank" rel="noopener noreferrer"><code>resolve::&lt;T&gt;()</code></a> or <a href="https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html#method.resolve_shared" target="_blank" rel="noopener noreferrer"><code>resolve_shared::&lt;T&gt;</code></a> methods of <a href="https://docs.rs/volga/latest/volga/middleware/http_context/struct.HttpContext.html" target="_blank" rel="noopener noreferrer"><code>HttpContext</code></a>. The main difference between them is that the first one requires to implement the <a href="https://doc.rust-lang.org/std/clone/trait.Clone.html" target="_blank" rel="noopener noreferrer"><code>Clone</code></a> trait for <code>T</code> while the latter returns an <a href="https://doc.rust-lang.org/std/sync/struct.Arc.html" target="_blank" rel="noopener noreferrer"><code>Arc&lt;T&gt;</code></a>.</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line">app<span class="token punctuation">.</span><span class="token function">use_middleware</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>ctx<span class="token punctuation">:</span> <span class="token class-name">HttpContext</span><span class="token punctuation">,</span> next<span class="token punctuation">:</span> <span class="token class-name">Next</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> cache <span class="token operator">=</span> ctx<span class="token punctuation">.</span><span class="token function">resolve</span><span class="token punctuation">::</span><span class="token operator">&lt;</span><span class="token class-name">InMemoryCache</span><span class="token operator">&gt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">?</span><span class="token punctuation">;</span></span>
<span class="line">    <span class="token comment">// do something....</span></span>
<span class="line">    <span class="token function">next</span><span class="token punctuation">(</span>ctx<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="summary" tabindex="-1"><a class="header-anchor" href="#summary"><span>Summary</span></a></h2><ul><li><strong>Singleton</strong>: Shared instance across the entire application lifecycle.</li><li><strong>Scoped</strong>: New instance for each HTTP request.</li><li><strong>Transient</strong>: New instance for every injection request.</li></ul><p>For more advanced examples, check out the <a href="https://github.com/RomanEmreis/volga/blob/main/examples/dependency_injection.rs" target="_blank" rel="noopener noreferrer">this</a>.</p>`,27)]))}const i=s(p,[["render",o],["__file","di.html.vue"]]),u=JSON.parse('{"path":"/advanced/di.html","title":"Dependency Injection","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Dependency Lifetimes","slug":"dependency-lifetimes","link":"#dependency-lifetimes","children":[{"level":3,"title":"Singleton","slug":"singleton","link":"#singleton","children":[]},{"level":3,"title":"Scoped","slug":"scoped","link":"#scoped","children":[]},{"level":3,"title":"Transient","slug":"transient","link":"#transient","children":[]}]},{"level":2,"title":"DI in middleware","slug":"di-in-middleware","link":"#di-in-middleware","children":[]},{"level":2,"title":"Summary","slug":"summary","link":"#summary","children":[]}],"git":{"updatedTime":1738859397000},"filePathRelative":"advanced/di.md"}');export{i as comp,u as data};
