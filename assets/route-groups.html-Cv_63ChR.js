import{_ as s,c as a,a as e,o as t}from"./app-CDshHqXG.js";const p={};function o(l,n){return t(),a("div",null,n[0]||(n[0]=[e(`<h1 id="route-groups" tabindex="-1"><a class="header-anchor" href="#route-groups"><span>Route Groups</span></a></h1><p>Volga provides a convenient mechanism for grouping routes using prefixes. This helps organize and manage related endpoints more effectively. You can achieve this by using the <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group" target="_blank" rel="noopener noreferrer"><code>map_group</code></a> method. Once a group is defined, you can apply the same mapping methods (e.g., <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get" target="_blank" rel="noopener noreferrer"><code>map_get</code></a> or <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post" target="_blank" rel="noopener noreferrer"><code>map_post</code></a>) as you would on the main application.</p><h3 id="example-usage" tabindex="-1"><a class="header-anchor" href="#example-usage"><span>Example Usage</span></a></h3><p>Here is an example demonstrating how to use route groups in a Volga application:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">HttpResult</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Group routes under the &quot;/user&quot; prefix</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_group</span><span class="token punctuation">(</span><span class="token string">&quot;/user&quot;</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/{id}&quot;</span><span class="token punctuation">,</span> get_user<span class="token punctuation">)</span>               <span class="token comment">// GET /user/{id}</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">map_post</span><span class="token punctuation">(</span><span class="token string">&quot;/create/{name}&quot;</span><span class="token punctuation">,</span> create_user<span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token comment">// POST /user/create/{name}</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">get_user</span><span class="token punctuation">(</span>_id<span class="token punctuation">:</span> <span class="token keyword">i32</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token class-name">HttpResult</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Read a user</span></span>
<span class="line">    <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;John&quot;</span><span class="token punctuation">)</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">create_user</span><span class="token punctuation">(</span>name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token class-name">HttpResult</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Create a user</span></span>
<span class="line">    <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;User {name} created!&quot;</span><span class="token punctuation">)</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="explanation" tabindex="-1"><a class="header-anchor" href="#explanation"><span>Explanation</span></a></h3><ul><li><strong>Route Group Definition</strong>:<br> The <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group" target="_blank" rel="noopener noreferrer"><code>map_group</code></a> method creates a <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html" target="_blank" rel="noopener noreferrer"><code>RouteGroup</code></a> that shares a common prefix, in this case, <code>/user</code>.</li><li><strong>Mapping Methods</strong>:<br> Within the group, routes are defined using methods like <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get" target="_blank" rel="noopener noreferrer"><code>map_get</code></a> and <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post" target="_blank" rel="noopener noreferrer"><code>map_post</code></a>. These work just like they do on the root application object but inherit the prefix defined in the group.</li></ul><p>You can find more examples <a href="https://github.com/RomanEmreis/volga/blob/main/examples/route_groups.rs" target="_blank" rel="noopener noreferrer">here</a>.</p>`,8)]))}const i=s(p,[["render",o],["__file","route-groups.html.vue"]]),r=JSON.parse('{"path":"/basics/route-groups.html","title":"Route Groups","lang":"en-US","frontmatter":{},"headers":[{"level":3,"title":"Example Usage","slug":"example-usage","link":"#example-usage","children":[]},{"level":3,"title":"Explanation","slug":"explanation","link":"#explanation","children":[]}],"git":{"updatedTime":1738859397000},"filePathRelative":"basics/route-groups.md"}');export{i as comp,r as data};
