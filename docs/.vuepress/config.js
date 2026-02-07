import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'
import { searchPlugin } from '@vuepress/plugin-search'
import { prismjsPlugin } from '@vuepress/plugin-prismjs'

export default defineUserConfig({
  locales: {
    '/': {
      lang: 'en-US',
      title: 'Volga',
      description: 'Easy & Fast Web Framework for Rust',
    },
    '/en/': {
      lang: 'en-US',
      title: 'Volga',
      description: 'Easy & Fast Web Framework for Rust',
    },
    '/ru/': {
      lang: 'ru-RU',
      title: 'Волга',
      description: 'Простой и быстрый веб-фреймворк для Rust',
    },
  },
  base: '/volga-docs/',
  theme: defaultTheme({
    contributors: false,
    smoothScroll: true,
    colorMode: 'auto',
    colorModeSwitch: true,
    locales: {
      '/en/': {
        selectLanguageName: 'English',
        navbar: [
          {
            text: 'Home',
            link: '/en/',
          },
          {
            text: 'API Docs',
            link: 'https://docs.rs/volga/latest/volga/',
          },
          {
            text: 'GitHub',
            link: 'https://github.com/RomanEmreis/volga',
          },
        ],
        sidebar: [
          {
            text: 'Home',
            link: '/en/',
          },
          {
            text: 'Getting Started',
            prefix: '/en/getting-started/',
            children: ['quick-start', 'route-params', 'query-params', 'route-groups'],
          },
          {
            text: 'Requests & Responses',
            prefix: '/en/requests-responses/',
            children: ['headers', 'json-payload', 'form', 'files', 'cookie'],
          },
          {
            text: 'Middleware & Infrastructure',
            prefix: '/en/middleware-infrastructure/',
            children: ['middleware', 'middlewares', 'compression', 'decompression', 'cors', 'static-files', 'rate-limiting'],
          },
          {
            text: 'Security & Access',
            prefix: '/en/security-access/',
            children: ['auth'],
          },
          {
            text: 'Reliability & Observability',
            prefix: '/en/reliability-observability/',
            children: ['errors', 'tracing', 'cancellation'],
          },
          {
            text: 'Protocols & Realtime',
            prefix: '/en/protocols-realtime/',
            children: ['http', 'https', 'ws', 'sse'],
          },
          {
            text: 'Advanced Patterns',
            prefix: '/en/advanced-patterns/',
            children: ['di', 'custom-trace-opt-head'],
          },
        ],
      },
      '/ru/': {
        selectLanguageName: 'Русский',
        navbar: [
          {
            text: 'Главная',
            link: '/ru/',
          },
          {
            text: 'API Docs',
            link: 'https://docs.rs/volga/latest/volga/',
          },
          {
            text: 'GitHub',
            link: 'https://github.com/RomanEmreis/volga',
          },
        ],
        sidebar: [
          {
            text: 'Главная',
            link: '/ru/',
          },
          {
            text: 'Старт',
            prefix: '/ru/getting-started/',
            children: ['quick-start', 'route-params', 'query-params', 'route-groups'],
          },
          {
            text: 'Запросы и ответы',
            prefix: '/ru/requests-responses/',
            children: ['headers', 'json-payload', 'form', 'files', 'cookie'],
          },
          {
            text: 'Middleware и инфраструктура',
            prefix: '/ru/middleware-infrastructure/',
            children: ['middleware', 'middlewares', 'compression', 'decompression', 'cors', 'static-files', 'rate-limiting'],
          },
          {
            text: 'Безопасность и доступ',
            prefix: '/ru/security-access/',
            children: ['auth'],
          },
          {
            text: 'Надежность и наблюдаемость',
            prefix: '/ru/reliability-observability/',
            children: ['errors', 'tracing', 'cancellation'],
          },
          {
            text: 'Протоколы и realtime',
            prefix: '/ru/protocols-realtime/',
            children: ['http', 'https', 'ws', 'sse'],
          },
          {
            text: 'Продвинутые паттерны',
            prefix: '/ru/advanced-patterns/',
            children: ['di', 'custom-trace-opt-head'],
          },
        ],
      },
    },
  }),

  bundler: viteBundler(),

  plugins: [
    searchPlugin({
      maxSuggestions: 10,
    }),
    prismjsPlugin({
      themes: {
        dark: 'one-dark',
        light: 'one-light',
      },
    }),
  ],
})
