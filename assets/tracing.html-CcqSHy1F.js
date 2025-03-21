import{_ as s,c as a,a as e,o as t}from"./app-CDshHqXG.js";const p={};function c(i,n){return t(),a("div",null,n[0]||(n[0]=[e(`<h1 id="tracing-logging" tabindex="-1"><a class="header-anchor" href="#tracing-logging"><span>Tracing &amp; Logging</span></a></h1><p>Volga&#39;s tracing and logging features are based on and support the <a href="https://docs.rs/tracing/latest/tracing/index.html" target="_blank" rel="noopener noreferrer">tracing framework</a> to collect structured, event-based diagnostic information out of the box. In addition to that, you can configure the including of the span/request/correction id into response headers to improve your app&#39;s observability.</p><p>If you&#39;re not using the <code>full</code> feature set, ensure you enable the <code>tracing</code> feature in your <code>Cargo.toml</code>, additonally you need to install the <a href="https://crates.io/crates/tracing" target="_blank" rel="noopener noreferrer"><code>tracing</code></a> and <a href="https://crates.io/crates/tracing-subscriber" target="_blank" rel="noopener noreferrer"><code>tracing-subscriber</code></a> crates:</p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.4.9&quot;</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">&quot;tracing&quot;</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"><span class="token key property">tracing</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.1&quot;</span></span>
<span class="line"><span class="token key property">tracing-subscriber</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.3&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="basic-configuration" tabindex="-1"><a class="header-anchor" href="#basic-configuration"><span>Basic configuration</span></a></h2><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token namespace">tracing<span class="token punctuation">::</span></span><span class="token class-name">TracingConfig</span><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">tracing<span class="token punctuation">::</span></span>trace<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">tracing_subscriber<span class="token punctuation">::</span>prelude<span class="token punctuation">::</span></span><span class="token operator">*</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Configuring tracing output to the stdout</span></span>
<span class="line">    <span class="token namespace">tracing_subscriber<span class="token punctuation">::</span></span><span class="token function">registry</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with</span><span class="token punctuation">(</span><span class="token namespace">tracing_subscriber<span class="token punctuation">::</span>fmt<span class="token punctuation">::</span></span><span class="token function">layer</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/tracing&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">trace!</span><span class="token punctuation">(</span><span class="token string">&quot;handling the request!&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token string">&quot;Done!&quot;</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>The above code enables basic tracing configuration with output to stdout. After you run this code, in your terminal you should see the following:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token number">2025</span>-01-23T13:09:30.616257Z  INFO volga::app: listening on: http://127.0.0.1:7878</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Then, if you&#39;ll hit the <code>GET http://127.0.0.1:7878/tracing</code> endpoint multiple times, and then turn off the server you should see something like this in your terminal:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token number">2025</span>-01-23T13:09:30.616257Z  INFO volga::app: listening on: http://127.0.0.1:7878</span>
<span class="line"><span class="token number">2025</span>-01-23T13:09:37.633319Z TRACE request: tracing: handling the request<span class="token operator">!</span></span>
<span class="line"><span class="token number">2025</span>-01-23T13:09:38.405932Z TRACE request: tracing: handling the request<span class="token operator">!</span></span>
<span class="line"><span class="token number">2025</span>-01-23T13:09:39.084540Z TRACE request: tracing: handling the request<span class="token operator">!</span></span>
<span class="line"><span class="token number">2025</span>-01-23T13:09:49.117861Z TRACE volga::app: <span class="token function">shutdown</span> signal received, not accepting new requests</span>
<span class="line"><span class="token number">2025</span>-01-23T13:09:49.119618Z  INFO volga::app: shutting down the server<span class="token punctuation">..</span>.</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="enabling-tracing-middleware" tabindex="-1"><a class="header-anchor" href="#enabling-tracing-middleware"><span>Enabling tracing middleware</span></a></h2><p>With the above example, however, if you check the response headers, you won&#39;t find anything related to span id, etc. To include it you may want to leverage the <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_tracing" target="_blank" rel="noopener noreferrer"><code>use_tracing()</code></a> method that enabled the middleware that adds this header.</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token namespace">tracing<span class="token punctuation">::</span></span><span class="token class-name">TracingConfig</span><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">tracing<span class="token punctuation">::</span></span>trace<span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">tracing_subscriber<span class="token punctuation">::</span>prelude<span class="token punctuation">::</span></span><span class="token operator">*</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span>v</span>
<span class="line">    <span class="token comment">// Configuring tracing output to the stdout</span></span>
<span class="line">    <span class="token namespace">tracing_subscriber<span class="token punctuation">::</span></span><span class="token function">registry</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with</span><span class="token punctuation">(</span><span class="token namespace">tracing_subscriber<span class="token punctuation">::</span>fmt<span class="token punctuation">::</span></span><span class="token function">layer</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line highlighted">    <span class="token comment">// Configure tracing parameters</span></span>
<span class="line highlighted">    <span class="token keyword">let</span> tracing <span class="token operator">=</span> <span class="token class-name">TracingConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line highlighted">        <span class="token punctuation">.</span><span class="token function">with_header</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">set_tracing</span><span class="token punctuation">(</span>tracing<span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line highlighted">    <span class="token comment">// Enable tracing middleware</span></span>
<span class="line highlighted">    app<span class="token punctuation">.</span><span class="token function">use_tracing</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/tracing&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">trace!</span><span class="token punctuation">(</span><span class="token string">&quot;handling the request!&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token string">&quot;Done!&quot;</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>By default it adds the <code>request-id</code> HTTP response header, if you want to use your own header you can configure it with the <a href="https://docs.rs/volga/latest/volga/tracing/struct.TracingConfig.html#method.with_header_name" target="_blank" rel="noopener noreferrer"><code>with_header_name()</code></a> method from <a href="https://docs.rs/volga/latest/volga/tracing/struct.TracingConfig.html" target="_blank" rel="noopener noreferrer"><code>TracingConfig</code></a>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> tracing <span class="token operator">=</span> <span class="token class-name">TracingConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_header</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_header_name</span><span class="token punctuation">(</span><span class="token string">&quot;x-correlation-id&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Then you can test in with the <code>curl</code> command:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token parameter variable">-v</span> <span class="token parameter variable">--location</span> <span class="token string">&quot;http://127.0.0.1:7878/tracing&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">*   Trying <span class="token number">127.0</span>.0.1:7878<span class="token punctuation">..</span>.</span>
<span class="line">* Connected to <span class="token number">127.0</span>.0.1 <span class="token punctuation">(</span><span class="token number">127.0</span>.0.1<span class="token punctuation">)</span> port <span class="token number">7878</span></span>
<span class="line"><span class="token operator">&gt;</span> GET /tracing HTTP/1.1</span>
<span class="line"><span class="token operator">&gt;</span> Host: <span class="token number">127.0</span>.0.1:7878</span>
<span class="line"><span class="token operator">&gt;</span> User-Agent: curl/8.9.1</span>
<span class="line"><span class="token operator">&gt;</span> Accept: */*</span>
<span class="line"><span class="token operator">&gt;</span></span>
<span class="line">* Request completely sent off</span>
<span class="line"><span class="token operator">&lt;</span> HTTP/1.1 <span class="token number">200</span> OK</span>
<span class="line"><span class="token operator">&lt;</span> server: Volga</span>
<span class="line"><span class="token operator">&lt;</span> content-type: text/plain</span>
<span class="line"><span class="token operator">&lt;</span> x-correlation-id: <span class="token number">2252074691592193</span></span>
<span class="line"><span class="token operator">&lt;</span> content-length: <span class="token number">5</span></span>
<span class="line"><span class="token operator">&lt;</span> date: Fri, <span class="token number">10</span> Jan <span class="token number">2025</span> <span class="token number">14</span>:14:37 GMT</span>
<span class="line"><span class="token operator">&lt;</span></span>
<span class="line">Done<span class="token operator">!</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Full example you can find <a href="https://github.com/RomanEmreis/volga/blob/main/examples/tracing.rs" target="_blank" rel="noopener noreferrer">here</a></p>`,19)]))}const o=s(p,[["render",c],["__file","tracing.html.vue"]]),u=JSON.parse('{"path":"/advanced/tracing.html","title":"Tracing & Logging","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Basic configuration","slug":"basic-configuration","link":"#basic-configuration","children":[]},{"level":2,"title":"Enabling tracing middleware","slug":"enabling-tracing-middleware","link":"#enabling-tracing-middleware","children":[]}],"git":{"updatedTime":1742551187000},"filePathRelative":"advanced/tracing.md"}');export{o as comp,u as data};
