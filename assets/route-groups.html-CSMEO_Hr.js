import{_ as s,c as a,a as t,o as e}from"./app-CDshHqXG.js";const p={};function o(l,n){return e(),a("div",null,n[0]||(n[0]=[t(`<h1 id="группировка-маршрутов" tabindex="-1"><a class="header-anchor" href="#группировка-маршрутов"><span>Группировка маршрутов</span></a></h1><p>Волга предоставляет удобный механизм для группировки маршрутов с использованием префиксов. Это помогает более эффективно организовывать и управлять связанными конечными точками. Этого можно добиться с помощью метода <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group" target="_blank" rel="noopener noreferrer"><code>map_group</code></a>.</p><p>После определения группы можно применять те же методы сопоставления (например, <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get" target="_blank" rel="noopener noreferrer"><code>map_get</code></a> или <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post" target="_blank" rel="noopener noreferrer"><code>map_post</code></a>), что и в основном приложении.</p><h3 id="пример-использования" tabindex="-1"><a class="header-anchor" href="#пример-использования"><span>Пример использования</span></a></h3><p>Пример, демонстрирующий использование групп маршрутов в приложении:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token class-name">HttpResult</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Группирует маршруты по префиксу &quot;/user&quot;</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_group</span><span class="token punctuation">(</span><span class="token string">&quot;/user&quot;</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/{id}&quot;</span><span class="token punctuation">,</span> get_user<span class="token punctuation">)</span>               <span class="token comment">// GET /user/{id}</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">map_post</span><span class="token punctuation">(</span><span class="token string">&quot;/create/{name}&quot;</span><span class="token punctuation">,</span> create_user<span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token comment">// POST /user/create/{name}</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">get_user</span><span class="token punctuation">(</span>_id<span class="token punctuation">:</span> <span class="token keyword">i32</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token class-name">HttpResult</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Получаем пользователя</span></span>
<span class="line">    <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;John&quot;</span><span class="token punctuation">)</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">create_user</span><span class="token punctuation">(</span>name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token class-name">HttpResult</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Создаем пользователя</span></span>
<span class="line">    <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;User {name} created!&quot;</span><span class="token punctuation">)</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="пояснения" tabindex="-1"><a class="header-anchor" href="#пояснения"><span>Пояснения</span></a></h3><ul><li><strong>Группировка</strong>:<br> Метод <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.map_group" target="_blank" rel="noopener noreferrer"><code>map_group</code></a> создает <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html" target="_blank" rel="noopener noreferrer"><code>RouteGroup</code></a>, с префиксом <code>/user</code>.</li><li><strong>Сопоставление методов</strong>:<br> Внутри группы маршруты определяются с помощью таких методов, как <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_get" target="_blank" rel="noopener noreferrer"><code>map_get</code></a> и <a href="https://docs.rs/volga/latest/volga/app/router/struct.RouteGroup.html#method.map_post" target="_blank" rel="noopener noreferrer"><code>map_post</code></a>. Они работают так же, как и в основном объекте приложения, но наследуют префикс, определенный для группы.</li></ul><p>Больше примеров можно найти <a href="https://github.com/RomanEmreis/volga/blob/main/examples/route_groups.rs" target="_blank" rel="noopener noreferrer">здесь</a>.</p>`,9)]))}const r=s(p,[["render",o],["__file","route-groups.html.vue"]]),i=JSON.parse('{"path":"/ru/basics/route-groups.html","title":"Группировка маршрутов","lang":"ru-RU","frontmatter":{},"headers":[{"level":3,"title":"Пример использования","slug":"пример-использования","link":"#пример-использования","children":[]},{"level":3,"title":"Пояснения","slug":"пояснения","link":"#пояснения","children":[]}],"git":{"updatedTime":1738859397000},"filePathRelative":"ru/basics/route-groups.md"}');export{r as comp,i as data};
