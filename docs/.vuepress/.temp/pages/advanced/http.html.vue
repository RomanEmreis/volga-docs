<template><div><h1 id="http-1-and-http-2" tabindex="-1"><a class="header-anchor" href="#http-1-and-http-2"><span>HTTP/1 and HTTP/2</span></a></h1>
<p>Starting <strong>v0.3.1</strong> a specific version of HTTP can be configured.
By default if Volga dependency added like this:</p>
<div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre v-pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token string">"0.3.1"</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><p>There will be used HTTP/1 and if we need the HTTP/2 it can be enabled if we explicitly add the <code v-pre>http2</code> feature or use the <code v-pre>full</code>.</p>
<div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre v-pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token punctuation">{</span> <span class="token key property">version</span> <span class="token punctuation">=</span> <span class="token string">"0.3.1"</span><span class="token punctuation">,</span> <span class="token key property">features</span> <span class="token punctuation">=</span> <span class="token punctuation">[</span><span class="token string">"full"</span><span class="token punctuation">]</span> <span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><p>With the <code v-pre>full</code> the HTTP/2 will be used if it is possible, otherwise it will be switched to HTTP/1 automatically.</p>
</div></template>


