import{_ as n,c as a,a as e,o as t}from"./app-CDshHqXG.js";const p={};function l(i,s){return t(),a("div",null,s[0]||(s[0]=[e(`<h1 id="quick-start" tabindex="-1"><a class="header-anchor" href="#quick-start"><span>Quick Start</span></a></h1><p>Build a basic &quot;Hello, World&quot; Web API using Volga.</p><h2 id="prerequisites" tabindex="-1"><a class="header-anchor" href="#prerequisites"><span>Prerequisites</span></a></h2><h3 id="install-rust" tabindex="-1"><a class="header-anchor" href="#install-rust"><span>Install Rust</span></a></h3><p>If you haven&#39;t installed Rust yet, it is recommended to use the <code>rustup</code>. <a href="https://doc.rust-lang.org/book/ch01-01-installation.html" target="_blank" rel="noopener noreferrer">Here</a> is the official guide where you can find how to do it.</p><p>Volga currently has a minimum supported Rust version (MSRV) of 1.80. Running <code>rustup update</code> will ensure you have the latest Rust version available.</p><h3 id="create-an-app" tabindex="-1"><a class="header-anchor" href="#create-an-app"><span>Create an app</span></a></h3><p>Create a new binary-based app:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token function">cargo</span> new hello-world</span>
<span class="line"><span class="token builtin class-name">cd</span> hello-world</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><p>Add the following dependencies in your <code>Cargo.toml</code>:</p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.5.5&quot;</span></span>
<span class="line"><span class="token key property">tokio</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">&quot;1&quot;</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">&quot;full&quot;</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="setup" tabindex="-1"><a class="header-anchor" href="#setup"><span>Setup</span></a></h2><p>Create your main application in <code>main.rs</code>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Configure the server</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Example of simple GET request handler</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello, World!&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token comment">// Run the server</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="detailed-walkthrough" tabindex="-1"><a class="header-anchor" href="#detailed-walkthrough"><span>Detailed Walkthrough</span></a></h2><p>When the <a href="https://docs.rs/volga/latest/volga/app/struct.App.html" target="_blank" rel="noopener noreferrer"><code>App</code></a> struct is instantiated, it represents your API and by default binds it to <code>http://localhost:7878</code>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Or if you need to bind it to another socket, you can use the <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.bind" target="_blank" rel="noopener noreferrer"><code>bind()</code></a> method like this:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token comment">// Binds the server to http://localhost:5000</span></span>
<span class="line"><span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">bind</span><span class="token punctuation">(</span><span class="token string">&quot;localhost:5000&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><p>Next, map a specific handler to a route. For instance, mapping our handler to <code>GET /hello</code>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line">app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello, World!&quot;</span><span class="token punctuation">)</span></span>
<span class="line"><span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Ensure routes are mapped before you start the server with:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line">app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h2 id="testing-the-api" tabindex="-1"><a class="header-anchor" href="#testing-the-api"><span>Testing the API</span></a></h2><p>You can test your API using the <code>curl</code> command:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token parameter variable">-v</span> <span class="token string">&quot;http://localhost:7878/hello&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Response expected:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">* Host localhost:7878 was resolved.</span>
<span class="line">* IPv6: ::1</span>
<span class="line">* IPv4: <span class="token number">127.0</span>.0.1</span>
<span class="line">*   Trying <span class="token punctuation">[</span>::1<span class="token punctuation">]</span>:7878<span class="token punctuation">..</span>.</span>
<span class="line">* Connected to localhost <span class="token punctuation">(</span>::1<span class="token punctuation">)</span> port <span class="token number">7878</span></span>
<span class="line"><span class="token operator">&gt;</span> GET /hello HTTP/1.1</span>
<span class="line"><span class="token operator">&gt;</span> Host: localhost:7878</span>
<span class="line"><span class="token operator">&gt;</span> User-Agent: curl/8.9.1</span>
<span class="line"><span class="token operator">&gt;</span> Accept: */*</span>
<span class="line"><span class="token operator">&gt;</span></span>
<span class="line">* Request completely sent off</span>
<span class="line"><span class="token operator">&lt;</span> HTTP/1.1 <span class="token number">200</span> OK</span>
<span class="line"><span class="token operator">&lt;</span> date: Sun, <span class="token number">6</span> Oct <span class="token number">2024</span> 08:22:17 +0000</span>
<span class="line"><span class="token operator">&lt;</span> server: Volga</span>
<span class="line"><span class="token operator">&lt;</span> content-length: <span class="token number">12</span></span>
<span class="line"><span class="token operator">&lt;</span> content-type: text/plain</span>
<span class="line"><span class="token operator">&lt;</span></span>
<span class="line">* Connection <span class="token comment">#0 to host localhost left intact</span></span>
<span class="line">Hello, World<span class="token operator">!</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>You can also check out the full example <a href="https://github.com/RomanEmreis/volga/blob/main/examples/hello_world.rs" target="_blank" rel="noopener noreferrer">here</a></p>`,29)]))}const c=n(p,[["render",l],["__file","quick-start.html.vue"]]),r=JSON.parse('{"path":"/basics/quick-start.html","title":"Quick Start","lang":"en-US","frontmatter":{},"headers":[{"level":2,"title":"Prerequisites","slug":"prerequisites","link":"#prerequisites","children":[{"level":3,"title":"Install Rust","slug":"install-rust","link":"#install-rust","children":[]},{"level":3,"title":"Create an app","slug":"create-an-app","link":"#create-an-app","children":[]}]},{"level":2,"title":"Setup","slug":"setup","link":"#setup","children":[]},{"level":2,"title":"Detailed Walkthrough","slug":"detailed-walkthrough","link":"#detailed-walkthrough","children":[]},{"level":2,"title":"Testing the API","slug":"testing-the-api","link":"#testing-the-api","children":[]}],"git":{"updatedTime":1742551187000},"filePathRelative":"basics/quick-start.md"}');export{c as comp,r as data};
