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
      '/': {
        selectLanguageName: 'English',
        navbar: [
          {
            text: 'Home',
            link: '/',
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
            link: '/',
          },
          {
            text: 'Getting Started',
            prefix: '/basics/',
            children: [
              'quick-start',
              'route-params',
              'query-params',
              'route-groups'
            ]
          },
          {
            text: 'Requests & Responses',
            children: [
              {
                text: 'Basics',
                prefix: '/basics/',
                children: [
                  'headers'
                ]
              },
              {
                text: 'Data Formats',
                prefix: '/data/',
                children: [
                  'json-payload',
                  'form',
                  'files'
                ]
              },
              {
                text: 'Advanced',
                prefix: '/advanced/',
                children: [
                  'cookie'
                ]
              }
            ]
          },
          {
            text: 'Middleware & Infrastructure',
            prefix: '/advanced/',
            children: [
              'middleware',
              'middlewares',
              'compression',
              'decompression',
              'cors',
              'static-files',
              'rate-limiting'
            ]
          },
          {
            text: 'Security & Access',
            prefix: '/advanced/',
            children: [
              'auth'
            ]
          },
          {
            text: 'Reliability & Observability',
            prefix: '/advanced/',
            children: [
              'errors',
              'tracing',
              'cancellation'
            ]
          },
          {
            text: 'Protocols & Realtime',
            children: [
              {
                text: 'Protocols',
                prefix: '/protocols/',
                children: [
                  'http',
                  'https',
                  'ws'
                ]
              },
              {
                text: 'Data Formats',
                prefix: '/data/',
                children: [
                  'sse'
                ]
              }
            ]
          },
          {
            text: 'Advanced Patterns',
            prefix: '/advanced/',
            children: [
              'di',
              'custom-trace-opt-head'
            ]
          }
        ]
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
            prefix: '/ru/basics/',
            children: [
              'quick-start',
              'route-params',
              'query-params',
              'route-groups'
            ]
          },
          {
            text: 'Запросы и ответы',
            children: [
              {
                text: 'Основы',
                prefix: '/ru/basics/',
                children: [
                  'headers'
                ]
              },
              {
                text: 'Форматы данных',
                prefix: '/ru/data/',
                children: [
                  'json-payload',
                  'form',
                  'files'
                ]
              },
              {
                text: 'Продвинутые сценарии',
                prefix: '/ru/advanced/',
                children: [
                  'cookie'
                ]
              }
            ]
          },
          {
            text: 'Middleware и инфраструктура',
            prefix: '/ru/advanced/',
            children: [
              'middleware',
              'middlewares',
              'compression',
              'decompression',
              'cors',
              'static-files',
              'rate-limiting'
            ]
          },
          {
            text: 'Безопасность и доступ',
            prefix: '/ru/advanced/',
            children: [
              'auth'
            ]
          },
          {
            text: 'Надежность и наблюдаемость',
            prefix: '/ru/advanced/',
            children: [
              'errors',
              'tracing',
              'cancellation'
            ]
          },
          {
            text: 'Протоколы и realtime',
            children: [
              {
                text: 'Протоколы',
                prefix: '/ru/protocols/',
                children: [
                  'http',
                  'https',
                  'ws'
                ]
              },
              {
                text: 'Форматы данных',
                prefix: '/ru/data/',
                children: [
                  'sse'
                ]
              }
            ]
          },
          {
            text: 'Продвинутые паттерны',
            prefix: '/ru/advanced/',
            children: [
              'di',
              'custom-trace-opt-head'
            ]
          }
        ]
      }
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
        light: 'one-light'
      }
    }) 
  ],
})
