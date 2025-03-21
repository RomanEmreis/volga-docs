import{_ as n,c as a,a as e,o as p}from"./app-CDshHqXG.js";const t={};function l(o,s){return p(),a("div",null,s[0]||(s[0]=[e(`<h1 id="query-parameters" tabindex="-1"><a class="header-anchor" href="#query-parameters"><span>Query Parameters</span></a></h1><p>Volga supports extraction of query parameters into dedicated struct by using <a href="https://docs.rs/volga/latest/volga/http/endpoints/args/query/struct.Query.html" target="_blank" rel="noopener noreferrer"><code>Query&lt;T&gt;</code></a>. Where <code>T</code> should be either deserializable struct or <a href="https://doc.rust-lang.org/std/collections/struct.HashMap.html" target="_blank" rel="noopener noreferrer"><code>HashMap</code></a>. If you&#39;d like to use a struct, similarly to <a href="https://docs.rs/volga/latest/volga/http/endpoints/args/path/struct.Path.html" target="_blank" rel="noopener noreferrer"><code>Path&lt;T&gt;</code></a> for route params, make sure that you also have <a href="https://crates.io/crates/serde" target="_blank" rel="noopener noreferrer">serde</a> installed.</p><h2 id="access-query-parameters" tabindex="-1"><a class="header-anchor" href="#access-query-parameters"><span>Access Query Parameters</span></a></h2><p>To demonstrate how to access query parameters, consider the following example:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">Query</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">serde<span class="token punctuation">::</span></span><span class="token class-name">Deserialize</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[derive(Deserialize)]</span></span>
<span class="line"><span class="token keyword">struct</span> <span class="token type-definition class-name">Params</span> <span class="token punctuation">{</span></span>
<span class="line">    name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>params<span class="token punctuation">:</span> <span class="token class-name">Query</span><span class="token operator">&lt;</span><span class="token class-name">Params</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {}!&quot;</span><span class="token punctuation">,</span> params<span class="token punctuation">.</span>name<span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="testing-the-api-with-query-parameters" tabindex="-1"><a class="header-anchor" href="#testing-the-api-with-query-parameters"><span>Testing the API with Query Parameters</span></a></h2><p>You can test the API by making requests with query parameters:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token string">&quot;http://localhost:7878/hello?name=John&quot;</span></span>
<span class="line">Hello John<span class="token operator">!</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token string">&quot;http://localhost:7878/hello?name=Jane&quot;</span></span>
<span class="line">Hello Jane<span class="token operator">!</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token string">&quot;http://localhost:7878/hello?name=World&quot;</span></span>
<span class="line">Hello World<span class="token operator">!</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="handling-multiple-query-parameters" tabindex="-1"><a class="header-anchor" href="#handling-multiple-query-parameters"><span>Handling Multiple Query Parameters</span></a></h2><p>For APIs that require multiple query parameters, you can set them up similarly:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">Query</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">serde<span class="token punctuation">::</span></span><span class="token class-name">Deserialize</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[derive(Deserialize)]</span></span>
<span class="line"><span class="token keyword">struct</span> <span class="token type-definition class-name">Params</span> <span class="token punctuation">{</span></span>
<span class="line">    name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span></span>
<span class="line">    age<span class="token punctuation">:</span> <span class="token keyword">u32</span><span class="token punctuation">,</span></span>
<span class="line">    email<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>params<span class="token punctuation">:</span> <span class="token class-name">Query</span><span class="token operator">&lt;</span><span class="token class-name">Params</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Here you can directly access the params struct fields</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {} (email: {})! Your age is: {}&quot;</span><span class="token punctuation">,</span> params<span class="token punctuation">.</span>name<span class="token punctuation">,</span> params<span class="token punctuation">.</span>email<span class="token punctuation">,</span> params<span class="token punctuation">.</span>age<span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Testing this with multiple query parameters will yield:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token string">&quot;http://localhost:7878/hello?name=John&amp;age=33&amp;email=john@email.com&quot;</span></span>
<span class="line">Hello John <span class="token punctuation">(</span>email: john@email.com<span class="token punctuation">)</span><span class="token operator">!</span> Your age is: <span class="token number">33</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="handle-optional-params" tabindex="-1"><a class="header-anchor" href="#handle-optional-params"><span>Handle optional params</span></a></h2><p>For the example above if we run the <code>curl</code> command by ignoring some parameter, e.g. <code>email</code> we&#39;ll get the <code>400 BAD REQUEST</code> response:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token string">&quot;http://localhost:7878/hello?name=John&amp;age=33&quot;</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">&lt;</span> HTTP/1.1 <span class="token number">400</span> BAD REQUEST</span>
<span class="line">Query parsing error: missing field <span class="token variable"><span class="token variable">\`</span>name<span class="token variable">\`</span></span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>However, if we want to keep some of the parameters as optional, we can wrap them in <a href="https://doc.rust-lang.org/std/option/" target="_blank" rel="noopener noreferrer"><code>Option&lt;T&gt;</code></a> as follows:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">Query</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">serde<span class="token punctuation">::</span></span><span class="token class-name">Deserialize</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[derive(Deserialize)]</span></span>
<span class="line"><span class="token keyword">struct</span> <span class="token type-definition class-name">Params</span> <span class="token punctuation">{</span></span>
<span class="line">    name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span></span>
<span class="line">    age<span class="token punctuation">:</span> <span class="token keyword">u32</span><span class="token punctuation">,</span></span>
<span class="line">    email<span class="token punctuation">:</span> <span class="token class-name">Option</span><span class="token operator">&lt;</span><span class="token class-name">String</span><span class="token operator">&gt;</span><span class="token punctuation">,</span> <span class="token comment">// making email as optional parameter</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>params<span class="token punctuation">:</span> <span class="token class-name">Query</span><span class="token operator">&lt;</span><span class="token class-name">Params</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token keyword">if</span> <span class="token keyword">let</span> <span class="token class-name">Some</span><span class="token punctuation">(</span>email<span class="token punctuation">)</span> <span class="token operator">=</span> params<span class="token punctuation">.</span>email <span class="token punctuation">{</span></span>
<span class="line">            <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {} (email: {})! Your age is: {}&quot;</span><span class="token punctuation">,</span> params<span class="token punctuation">.</span>name<span class="token punctuation">,</span> params<span class="token punctuation">.</span>email<span class="token punctuation">,</span> params<span class="token punctuation">.</span>age<span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">}</span> <span class="token keyword">else</span> <span class="token punctuation">{</span></span>
<span class="line">            <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {}! Your age is: {}&quot;</span><span class="token punctuation">,</span> params<span class="token punctuation">.</span>name<span class="token punctuation">,</span> params<span class="token punctuation">.</span>age<span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">}</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>This guide should provide you with the tools needed to efficiently utilize query parameters in your Volga-based web applications.</p><p>You can check out the full example <a href="https://github.com/RomanEmreis/volga/blob/main/examples/query_params.rs" target="_blank" rel="noopener noreferrer">here</a></p>`,20)]))}const i=n(t,[["render",l],["__file","query-params.html.vue"]]),u=JSON.parse('{"path":"/basics/query-params.html","title":"Query Parameters","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Access Query Parameters","slug":"access-query-parameters","link":"#access-query-parameters","children":[]},{"level":2,"title":"Testing the API with Query Parameters","slug":"testing-the-api-with-query-parameters","link":"#testing-the-api-with-query-parameters","children":[]},{"level":2,"title":"Handling Multiple Query Parameters","slug":"handling-multiple-query-parameters","link":"#handling-multiple-query-parameters","children":[]},{"level":2,"title":"Handle optional params","slug":"handle-optional-params","link":"#handle-optional-params","children":[]}],"git":{"updatedTime":1738859397000},"filePathRelative":"basics/query-params.md"}');export{i as comp,u as data};
