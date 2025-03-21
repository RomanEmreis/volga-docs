import{_ as n,c as a,a as e,o as t}from"./app-CDshHqXG.js";const p={};function l(c,s){return t(),a("div",null,s[0]||(s[0]=[e(`<h1 id="https" tabindex="-1"><a class="header-anchor" href="#https"><span>HTTPS</span></a></h1><p>Волга поддерживает протоколы HTTPS/TLS, реализованные поверх библиотеки <code>rustls</code>.</p><p>Если вы не используете набор функций <code>full</code>, убедитесь, что вы включили функцию <code>tls</code> в <code>Cargo.toml</code>:</p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.4.8&quot;</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">&quot;tls&quot;</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="простои-https-сервер" tabindex="-1"><a class="header-anchor" href="#простои-https-сервер"><span>Простой HTTPS сервер</span></a></h2><h3 id="генерация-self-signed-сертификатов" tabindex="-1"><a class="header-anchor" href="#генерация-self-signed-сертификатов"><span>Генерация Self-Signed сертификатов</span></a></h3><p>Прежде всего, вам необходимо сгенерировать сертификат и закрытый ключ. Для тестирования вы можете использовать следующую команду:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">openssl req <span class="token parameter variable">-x509</span> <span class="token parameter variable">-newkey</span> rsa:4096 <span class="token parameter variable">-nodes</span> <span class="token parameter variable">-keyout</span> key.pem <span class="token parameter variable">-out</span> cert.pem <span class="token parameter variable">-days</span> <span class="token number">365</span> <span class="token parameter variable">-subj</span> <span class="token string">&#39;/CN=localhost&#39;</span>\`</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h3 id="код-для-использования-сертификата-и-закрытого-ключа" tabindex="-1"><a class="header-anchor" href="#код-для-использования-сертификата-и-закрытого-ключа"><span>Код для использования сертификата и закрытого ключа</span></a></h3><p>Если вы сгенерировали сертификат и закрытый ключ в папке, где находится ваш <code>Cargo.toml</code>, вы можете просто сделать следующее:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token namespace">tls<span class="token punctuation">::</span></span><span class="token class-name">TlsConfig</span><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">set_tls</span><span class="token punctuation">(</span><span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token string">&quot;Hello, World!&quot;</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>По умолчанию <a href="https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html" target="_blank" rel="noopener noreferrer"><code>TlsConfig</code></a> считывает эти файлы из этой папки и ожидает имена: <code>cert.pem</code> и <code>key.pem</code>. Если вы создали эти файлы в другой папке, вы можете настроить TLS следующим образом:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> config <span class="token operator">=</span> <span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">from_pem</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>В случае, если у вас другие имена файлов, вы можете указать их отдельно:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> config <span class="token operator">=</span> <span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_cert_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.pem&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_key_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.key&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Вы можете протестировать приведенный выше код, используя команду <code>curl</code>:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token parameter variable">-v</span> <span class="token string">&quot;https://localhost:7878/hello&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h2 id="проверка-подлинности-клиента" tabindex="-1"><a class="header-anchor" href="#проверка-подлинности-клиента"><span>Проверка подлинности клиента</span></a></h2><p>Аутентификация клиента отключена по-умолчанию. Вы можете включить ее как необязательную или обязательную. Основное отличие в том, что в первом случае сервер все равно разрешает анонимные запросы.</p><h3 id="генерация-ca-сертификата-и-закрытого-ключе" tabindex="-1"><a class="header-anchor" href="#генерация-ca-сертификата-и-закрытого-ключе"><span>Генерация CA сертификата и закрытого ключе</span></a></h3><p>Сначала давайте выполним следующие команды для генерации сертификата CA (Client Authority) и закрытого ключа:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">openssl genrsa <span class="token parameter variable">-out</span> ca.key <span class="token number">2048</span></span>
<span class="line">openssl req <span class="token parameter variable">-x509</span> <span class="token parameter variable">-new</span> <span class="token parameter variable">-nodes</span> <span class="token parameter variable">-key</span> ca.key <span class="token parameter variable">-sha256</span> <span class="token parameter variable">-days</span> <span class="token number">3650</span> <span class="token parameter variable">-out</span> ca.pem <span class="token parameter variable">-subj</span> <span class="token string">&quot;/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=CA&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="необязательная-аутентификация" tabindex="-1"><a class="header-anchor" href="#необязательная-аутентификация"><span>Необязательная Аутентификация</span></a></h3><p>Таким образом, можно настроить необязательную (опциональную) аутентификацию:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> config <span class="token operator">=</span> <span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_cert_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.pem&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_key_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.key&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_optional_client_auth</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/ca.pem&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="обязательная-аутентификация" tabindex="-1"><a class="header-anchor" href="#обязательная-аутентификация"><span>Обязательная Аутентификация</span></a></h3><p>Вот так, можно настроить обязательную аутентификацию:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> config <span class="token operator">=</span> <span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_cert_path</span><span class="token punctuation">(</span><span class="token string">&quot;tests/tls/server.pem&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_key_path</span><span class="token punctuation">(</span><span class="token string">&quot;tests/tls/server.key&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_required_client_auth</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/ca.pem&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Затем вам, так же, необходимо сгенерировать клиентский сертификат и закрытый ключ:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">openssl req <span class="token parameter variable">-x509</span> <span class="token parameter variable">-newkey</span> rsa:4096 <span class="token parameter variable">-nodes</span> <span class="token parameter variable">-keyout</span> client.key <span class="token parameter variable">-out</span> client.pem <span class="token parameter variable">-days</span> <span class="token number">365</span> <span class="token parameter variable">-subj</span> <span class="token string">&#39;/CN=localhost&#39;</span>\`</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>И, наконец, можно протестировать при помощи <code>curl</code>:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token parameter variable">--cert</span> client.pem <span class="token parameter variable">--key</span> client.key <span class="token parameter variable">--cacert</span> ca.pem https://localhost:7878/hello</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h2 id="перенаправление-https" tabindex="-1"><a class="header-anchor" href="#перенаправление-https"><span>Перенаправление HTTPS</span></a></h2><p>Волга также позволяет вам настроить перенаправление с HTTP-запроса на HTTPS. Вы можете настроить его, используя метод <a href="https://docs.rs/volga/latest/volga/tls/struct.TlsConfig.html#method.with_https_redirection" target="_blank" rel="noopener noreferrer"><code>with_https_redirection()</code></a>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> config <span class="token operator">=</span> <span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_cert_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.pem&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_key_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.key&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_https_redirection</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>HTTP-порт по умолчанию — <code>7879</code>, но вы можете изменить его на любой другой:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">let</span> config <span class="token operator">=</span> <span class="token class-name">TlsConfig</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_cert_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.pem&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_key_path</span><span class="token punctuation">(</span><span class="token string">&quot;path/to/certs/server.key&quot;</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_https_redirection</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">.</span><span class="token function">with_http_port</span><span class="token punctuation">(</span><span class="token number">7979</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Теперь, если вы запустите следующую команду <code>curl</code>, ваш запрос будет перенаправлен на <code>https://localhost:7878/hello</code>:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line"><span class="token operator">&gt;</span> <span class="token function">curl</span> <span class="token parameter variable">-v</span> <span class="token string">&quot;http://localhost:7979/hello&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Внутри, когда вы запускаете этот код в режиме отладки, он использует <a href="https://developer.mozilla.org/ru/docs/Web/HTTP/Status/307" target="_blank" rel="noopener noreferrer">Temporary Redirect</a> (307), поскольку кэширование ссылок может привести к нестабильному поведению в среде для разработки. Однако в режиме релиза он отвечает 308 - <a href="https://developer.mozilla.org/ru/docs/Web/HTTP/Status/308" target="_blank" rel="noopener noreferrer">Permanent Redirect</a>.</p><h2 id="http-strict-transport-security-protocol-hsts" tabindex="-1"><a class="header-anchor" href="#http-strict-transport-security-protocol-hsts"><span>HTTP Strict Transport Security Protocol (HSTS)</span></a></h2><p>HTTP Strict Transport Security (HSTS) — это дополнительное улучшение безопасности, которое указывается веб-сервером с помощью специального заголовка ответа. Когда браузер, поддерживающий HSTS, получает этот заголовок:</p><ul><li>Браузер сохраняет конфигурацию для домена, которая запрещает отправку любых сообщений по HTTP.</li><li>Браузер принудительно переводит все сообщения по HTTPS.</li><li>Браузер не позволяет пользователю использовать ненадежные или недействительные сертификаты.</li><li>Браузер отключает запросы, которые позволяют пользователю временно доверять такому сертификату.</li></ul><p>Поскольку HSTS принудительно применяется клиентом, у него есть некоторые ограничения:</p><ul><li>Клиент должен поддерживать HSTS.</li><li>HSTS требует как минимум одного успешного запроса HTTPS для установки политики HSTS.</li><li>Приложение должно проверять каждый запрос HTTP и перенаправлять или отклонять запрос HTTP.</li></ul><p>Вы можете включить HSTS, используя метод <a href="https://docs.rs/volga/latest/volga/app/struct.App.html#method.use_hsts" target="_blank" rel="noopener noreferrer"><code>use_hsts()</code></a>:</p><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token punctuation">{</span><span class="token class-name">App</span><span class="token punctuation">,</span> <span class="token namespace">tls<span class="token punctuation">::</span></span><span class="token class-name">TlsConfig</span><span class="token punctuation">}</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span></span>
<span class="line">        <span class="token punctuation">.</span><span class="token function">with_tls</span><span class="token punctuation">(</span><span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>tls<span class="token closure-punctuation punctuation">|</span></span> tls<span class="token punctuation">.</span><span class="token function">with_https_redirection</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Включает HSTS middleware</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">use_hsts</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token string">&quot;Hello, World!&quot;</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Затем, если вы запустите этот код, вы получите HTTP-заголовок <code>Strict-Transport-Security</code> вместе с успешным ответом.</p><p>Больше примеров вы можете найти <a href="https://github.com/RomanEmreis/volga/blob/main/examples/tls.rs" target="_blank" rel="noopener noreferrer">здесь</a>.</p>`,49)]))}const i=n(p,[["render",l],["__file","https.html.vue"]]),r=JSON.parse('{"path":"/ru/protocols/https.html","title":"HTTPS","lang":"ru-RU","frontmatter":{},"headers":[{"level":2,"title":"Простой HTTPS сервер","slug":"простои-https-сервер","link":"#простои-https-сервер","children":[{"level":3,"title":"Генерация Self-Signed сертификатов","slug":"генерация-self-signed-сертификатов","link":"#генерация-self-signed-сертификатов","children":[]},{"level":3,"title":"Код для использования сертификата и закрытого ключа","slug":"код-для-использования-сертификата-и-закрытого-ключа","link":"#код-для-использования-сертификата-и-закрытого-ключа","children":[]}]},{"level":2,"title":"Проверка подлинности клиента","slug":"проверка-подлинности-клиента","link":"#проверка-подлинности-клиента","children":[{"level":3,"title":"Генерация CA сертификата и закрытого ключе","slug":"генерация-ca-сертификата-и-закрытого-ключе","link":"#генерация-ca-сертификата-и-закрытого-ключе","children":[]},{"level":3,"title":"Необязательная Аутентификация","slug":"необязательная-аутентификация","link":"#необязательная-аутентификация","children":[]},{"level":3,"title":"Обязательная Аутентификация","slug":"обязательная-аутентификация","link":"#обязательная-аутентификация","children":[]}]},{"level":2,"title":"Перенаправление HTTPS","slug":"перенаправление-https","link":"#перенаправление-https","children":[]},{"level":2,"title":"HTTP Strict Transport Security Protocol (HSTS)","slug":"http-strict-transport-security-protocol-hsts","link":"#http-strict-transport-security-protocol-hsts","children":[]}],"git":{"updatedTime":1742551187000},"filePathRelative":"ru/protocols/https.md"}');export{i as comp,r as data};
