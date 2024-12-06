import{_ as s,c as a,a as e,o as t}from"./app-jhnW9KFn.js";const p={};function l(o,n){return t(),a("div",null,n[0]||(n[0]=[e(`<h1 id="route-parameters" tabindex="-1"><a class="header-anchor" href="#route-parameters"><span>Route Parameters</span></a></h1><p>Volga offers robust routing configurations allowing you to harness dynamic routes using parameters. By utilizing the function arguments that implement <a href="https://doc.rust-lang.org/std/str/trait.FromStr.html" target="_blank" rel="noopener noreferrer"><code>FromStr</code></a> trait you can pass them directly to your request handler.</p><h2 id="example-single-route-parameter" tabindex="-1"><a class="header-anchor" href="#example-single-route-parameter"><span>Example: Single Route Parameter</span></a></h2><p>Here&#39;s how to set up a simple dynamic route that greets a user by name:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">Router</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello/{name}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {}!&quot;</span><span class="token punctuation">,</span> name<span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="testing-the-route" tabindex="-1"><a class="header-anchor" href="#testing-the-route"><span>Testing the Route</span></a></h2><p>In the curly brackets, we described the <code>GET</code> route with a <code>name</code> parameter, so if we run requests over the Web API it will call the desired handler and pass an appropriate <code>name</code> value as a function argument.</p><p>Using the <code>curl</code> command, you can test the above configuration:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> http://localhost:7878/hello/world</span>
<span class="line">Hello world<span class="token operator">!</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> http://localhost:7878/hello/earth</span>
<span class="line">Hello earth<span class="token operator">!</span></span>
<span class="line"></span>
<span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> http://localhost:7878/hello/sun</span>
<span class="line">Hello sun<span class="token operator">!</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="example-multiple-route-parameters" tabindex="-1"><a class="header-anchor" href="#example-multiple-route-parameters"><span>Example: Multiple Route Parameters</span></a></h2><p>You can also configure multiple parameters in a route. Here’s an example:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">Router</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello/{descr}/{name}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>descr<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span> name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {} {}!&quot;</span><span class="token punctuation">,</span> descr<span class="token punctuation">,</span> name<span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>When you run the following curl command, it will return:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token string">&quot;http://localhost:7878/hello/beautiful/world&quot;</span></span>
<span class="line">Hello beautiful world<span class="token operator">!</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><div class="hint-container warning"><p class="hint-container-title">Warning</p><p>It is important to keep the handler function&#39;s arguments order strictly the same as described in the route. So for the <code>hello/{descr}/{name}</code> it supposed to be <code>|descr: String, name: String|</code>.</p></div><h2 id="using-path-t" tabindex="-1"><a class="header-anchor" href="#using-path-t"><span>Using <code>Path&lt;T&gt;</code></span></a></h2><p>Alternatively, use the <a href="https://docs.rs/volga/latest/volga/app/endpoints/args/path/struct.Path.html" target="_blank" rel="noopener noreferrer"><code>Path&lt;T&gt;</code></a> to wrap the route parameters into dedicated struct. Where <code>T</code> should be either deserializable struct or <code>HashMap</code>. Make sure that you have also <a href="https://crates.io/crates/serde" target="_blank" rel="noopener noreferrer">serde</a> installed:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">Router</span><span class="token punctuation">,</span> <span class="token class-name">Path</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"><span class="token keyword">use</span> <span class="token namespace">serde<span class="token punctuation">::</span></span><span class="token class-name">Deserialize</span><span class="token punctuation">;</span></span>
<span class="line"> </span>
<span class="line"><span class="token attribute attr-name">#[derive(Deserialize)]</span></span>
<span class="line"><span class="token keyword">struct</span> <span class="token type-definition class-name">User</span> <span class="token punctuation">{</span></span>
<span class="line">    name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">,</span></span>
<span class="line">    age<span class="token punctuation">:</span> <span class="token keyword">u32</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// GET /hello/John/35</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello/{name}/{age}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>user<span class="token punctuation">:</span> <span class="token class-name">Path</span><span class="token operator">&lt;</span><span class="token class-name">User</span><span class="token operator">&gt;</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Here you can directly access the user struct fields</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {}! You&#39;re age is: {}!&quot;</span><span class="token punctuation">,</span> user<span class="token punctuation">.</span>name<span class="token punctuation">,</span> user<span class="token punctuation">.</span>age<span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Using these examples, you can add dynamic routing to your Volga-based web server, enhancing the flexibility and functionality of your applications.</p><p>Check out the full example <a href="https://github.com/RomanEmreis/volga/blob/main/examples/route_params.rs" target="_blank" rel="noopener noreferrer">here</a></p>`,20)]))}const i=s(p,[["render",l],["__file","route-params.html.vue"]]),u=JSON.parse('{"path":"/getting-started/route-params.html","title":"Route Parameters","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Example: Single Route Parameter","slug":"example-single-route-parameter","link":"#example-single-route-parameter","children":[]},{"level":2,"title":"Testing the Route","slug":"testing-the-route","link":"#testing-the-route","children":[]},{"level":2,"title":"Example: Multiple Route Parameters","slug":"example-multiple-route-parameters","link":"#example-multiple-route-parameters","children":[]},{"level":2,"title":"Using Path<T>","slug":"using-path-t","link":"#using-path-t","children":[]}],"git":{},"filePathRelative":"getting-started/route-params.md"}');export{i as comp,u as data};
