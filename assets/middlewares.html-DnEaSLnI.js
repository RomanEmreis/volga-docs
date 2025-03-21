import{_ as s,c as a,a as e,o as p}from"./app-CDshHqXG.js";const t={};function l(c,n){return p(),a("div",null,n[0]||(n[0]=[e(`<h1 id="пользовательские-middleware" tabindex="-1"><a class="header-anchor" href="#пользовательские-middleware"><span>Пользовательские Middleware</span></a></h1><p>Волга предоставляет гибкий конвейер middleware, который позволяет обрабатывать и изменять HTTP-запросы и ответы последовательно через функции middleware перед передачей управления конечному обработчику запросов, а так же и после обработки.</p><h2 id="обзор-работы-middleware" tabindex="-1"><a class="header-anchor" href="#обзор-работы-middleware"><span>Обзор работы Middleware</span></a></h2><p>Каждая функция middleware в конвейере должна явно вызывать замыкание <a href="https://docs.rs/volga/latest/volga/middleware/type.Next.html" target="_blank" rel="noopener noreferrer"><code>next</code></a> для передачи управления следующему middleware или обработчику запроса. Если замыкание <a href="https://docs.rs/volga/latest/volga/middleware/type.Next.html" target="_blank" rel="noopener noreferrer"><code>next</code></a> не вызвано, выполнение оставшейся части конвейера прерывается, что может быть полезно для обработки определённых условий до дальнейших этапов обработки.</p><p>Возможность вызова замыкания <a href="https://docs.rs/volga/latest/volga/middleware/type.Next.html" target="_blank" rel="noopener noreferrer"><code>next</code></a> предоставляет большой контроль над потоком выполнения, позволяя запускать код до или после последующих функций middleware или обработчика запроса.</p><h2 id="настроика-middleware" tabindex="-1"><a class="header-anchor" href="#настроика-middleware"><span>Настройка Middleware</span></a></h2><p>Прежде всего, если вы не используете функцию <code>full</code>, то либо необходимо добавить функцию <code>middleware</code>, либо переключиться на <code>full</code> в вашем <code>Cargo.toml</code>:</p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.4.4&quot;</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">&quot;middleware&quot;</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="пример-последовательное-выполнение-middleware" tabindex="-1"><a class="header-anchor" href="#пример-последовательное-выполнение-middleware"><span>Пример: Последовательное выполнение Middleware</span></a></h3><p>Практический пример настройки последовательного выполнения middleware в Volga:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> ok<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Настройка сервера</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Middleware 1</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_middleware</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>context<span class="token punctuation">,</span> next<span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Код до выполнения Middleware 2</span></span>
<span class="line">        <span class="token macro property">println!</span><span class="token punctuation">(</span><span class="token string">&quot;Перед Middleware 2&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        <span class="token keyword">let</span> response <span class="token operator">=</span> <span class="token function">next</span><span class="token punctuation">(</span>context<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        <span class="token comment">// Код после завершения Middleware 2</span></span>
<span class="line">        <span class="token macro property">println!</span><span class="token punctuation">(</span><span class="token string">&quot;После Middleware 2&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        response</span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Middleware 2</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_middleware</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>context<span class="token punctuation">,</span> next<span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Код до выполнения обработчика запроса</span></span>
<span class="line">        <span class="token macro property">println!</span><span class="token punctuation">(</span><span class="token string">&quot;Перед обработчиком запроса&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        <span class="token keyword">let</span> response <span class="token operator">=</span> <span class="token function">next</span><span class="token punctuation">(</span>context<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        <span class="token comment">// Код после завершения обработчика запроса</span></span>
<span class="line">        <span class="token macro property">println!</span><span class="token punctuation">(</span><span class="token string">&quot;После обработчика запроса&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        response</span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token comment">// Пример обработчика запроса</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello World!&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token comment">// Запуск сервера</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="пример-прерывание-конвеиера-middleware" tabindex="-1"><a class="header-anchor" href="#пример-прерывание-конвеиера-middleware"><span>Пример: Прерывание конвейера Middleware</span></a></h3><p>Следующий пример демонстрирует, как прервать выполнение конвейера middleware, чтобы предотвратить выполнение обработчика запроса. Такой подход особенно полезен для реализации авторизационных фильтров или проверок, которые могут завершить запрос на раннем этапе:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> ok<span class="token punctuation">,</span> status<span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Настройка сервера</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Middleware 1</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_middleware</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>context<span class="token punctuation">,</span> next<span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Код до выполнения Middleware 2</span></span>
<span class="line">        <span class="token macro property">println!</span><span class="token punctuation">(</span><span class="token string">&quot;Обработано Middleware 1&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        <span class="token keyword">let</span> response <span class="token operator">=</span> <span class="token function">next</span><span class="token punctuation">(</span>context<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        <span class="token comment">// Код после завершения Middleware 2</span></span>
<span class="line">        <span class="token macro property">println!</span><span class="token punctuation">(</span><span class="token string">&quot;Возврат в Middleware 1&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">        response</span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Middleware 2</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_middleware</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>context<span class="token punctuation">,</span> _next<span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Немедленный возврат без вызова &#39;next&#39;, прерывание конвейера</span></span>
<span class="line">        <span class="token macro property">status!</span><span class="token punctuation">(</span><span class="token number">400</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token comment">// Пример асинхронного обработчика запроса</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token comment">// Этот код никогда не будет выполнен</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token comment">// Запуск сервера</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Полный пример можно найти <a href="https://github.com/RomanEmreis/volga/blob/main/examples/middleware.rs" target="_blank" rel="noopener noreferrer">здесь</a>.</p>`,15)]))}const i=s(t,[["render",l],["__file","middlewares.html.vue"]]),u=JSON.parse('{"path":"/ru/advanced/middlewares.html","title":"Пользовательские Middleware","lang":"ru-RU","frontmatter":{},"headers":[{"level":2,"title":"Обзор работы Middleware","slug":"обзор-работы-middleware","link":"#обзор-работы-middleware","children":[]},{"level":2,"title":"Настройка Middleware","slug":"настроика-middleware","link":"#настроика-middleware","children":[{"level":3,"title":"Пример: Последовательное выполнение Middleware","slug":"пример-последовательное-выполнение-middleware","link":"#пример-последовательное-выполнение-middleware","children":[]},{"level":3,"title":"Пример: Прерывание конвейера Middleware","slug":"пример-прерывание-конвеиера-middleware","link":"#пример-прерывание-конвеиера-middleware","children":[]}]}],"git":{"updatedTime":1738859397000},"filePathRelative":"ru/advanced/middlewares.md"}');export{i as comp,u as data};
