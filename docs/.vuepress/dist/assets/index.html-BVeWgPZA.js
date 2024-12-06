import{_ as s,c as a,a as e,o as t}from"./app-jhnW9KFn.js";const p={};function o(l,n){return t(),a("div",null,n[0]||(n[0]=[e(`<h1 id="volga" tabindex="-1"><a class="header-anchor" href="#volga"><span>Volga</span></a></h1><p>Fast, Easy, and very flexible Web Framework for Rust based on <a href="https://tokio.rs/" target="_blank" rel="noopener noreferrer">Tokio</a> runtime and <a href="https://hyper.rs/" target="_blank" rel="noopener noreferrer">hyper</a> for fun and painless microservices crafting.</p><p><a href="https://crates.io/crates/volga" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/crates.io-0.4.1-blue" alt="latest"></a><a href="https://www.rust-lang.org/" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/rustc-1.80+-964B00" alt="latest"></a><a href="https://github.com/RomanEmreis/volga/blob/main/LICENSE" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/License-MIT-violet.svg" alt="License: MIT"></a><a href="https://github.com/RomanEmreis/volga/actions/workflows/rust.yml" target="_blank" rel="noopener noreferrer"><img src="https://github.com/RomanEmreis/volga/actions/workflows/rust.yml/badge.svg" alt="Build"></a><a href="https://github.com/RomanEmreis/volga/actions/workflows/release.yml" target="_blank" rel="noopener noreferrer"><img src="https://github.com/RomanEmreis/volga/actions/workflows/release.yml/badge.svg" alt="Release"></a></p><div class="language-toml line-numbers-mode" data-highlighter="prismjs" data-ext="toml" data-title="toml"><pre><code><span class="line"><span class="token punctuation">[</span><span class="token table class-name">dependencies</span><span class="token punctuation">]</span></span>
<span class="line"><span class="token key property">volga</span> <span class="token punctuation">=</span> <span class="token string">&quot;0.4.1&quot;</span></span>
<span class="line"><span class="token key property">tokio</span> <span class="token punctuation">=</span> <span class="token string">&quot;1.41.1&quot;</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-rust line-numbers-mode" data-highlighter="prismjs" data-ext="rs" data-title="rs"><pre><code><span class="line"><span class="token keyword">use</span> <span class="token namespace">volga<span class="token punctuation">::</span></span><span class="token operator">*</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line"><span class="token attribute attr-name">#[tokio::main]</span></span>
<span class="line"><span class="token keyword">async</span> <span class="token keyword">fn</span> <span class="token function-definition function">main</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">-&gt;</span> <span class="token namespace">std<span class="token punctuation">::</span>io<span class="token punctuation">::</span></span><span class="token class-name">Result</span><span class="token operator">&lt;</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token operator">&gt;</span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token comment">// Configure the HTTP server</span></span>
<span class="line">    <span class="token keyword">let</span> <span class="token keyword">mut</span> app <span class="token operator">=</span> <span class="token class-name">App</span><span class="token punctuation">::</span><span class="token function">new</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">bind</span><span class="token punctuation">(</span><span class="token string">&quot;localhost:7878&quot;</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token comment">// Configure the GET request handler</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">map_get</span><span class="token punctuation">(</span><span class="token string">&quot;/hello/{name}&quot;</span><span class="token punctuation">,</span> <span class="token closure-params"><span class="token closure-punctuation punctuation">|</span>name<span class="token punctuation">:</span> <span class="token class-name">String</span><span class="token closure-punctuation punctuation">|</span></span> <span class="token keyword">async</span> <span class="token keyword">move</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token macro property">ok!</span><span class="token punctuation">(</span><span class="token string">&quot;Hello {}!&quot;</span><span class="token punctuation">,</span> name<span class="token punctuation">)</span></span>
<span class="line">    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span></span>
<span class="line">    </span>
<span class="line">    <span class="token comment">// Run it</span></span>
<span class="line">    app<span class="token punctuation">.</span><span class="token function">run</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token keyword">await</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,5)]))}const i=s(p,[["render",o],["__file","index.html.vue"]]),r=JSON.parse('{"path":"/","title":"Volga","lang":"en-US","frontmatter":{},"headers":[],"git":{},"filePathRelative":"README.md"}');export{i as comp,r as data};
