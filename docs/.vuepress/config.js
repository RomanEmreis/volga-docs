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
            text: 'Basics',
            prefix: '/basics/',
            children: [
              'quick-start',
              'route-params',
              'query-params',
              `route-groups`,
              'headers',
            ]
          },
          {
            text: 'Data Formats',
            prefix: '/data/',
            children: [
              'json-payload',
              'form',
              'files',
              'sse'
            ]
          },
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
            text: 'Advanced',
            prefix: '/advanced/',
            children: [
              'middlewares',
              `compression`,
              `decompression`,
              'errors',
              'di',
              'tracing',
              'static-files',
              'cors',
              'cancellation',
              'custom-trace-opt-head',
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
            text: 'Основы',
            prefix: '/ru/basics/',
            children: [
              'quick-start',
              'route-params',
              'query-params',
              `route-groups`,
              'headers',
            ]
          },
          {
            text: 'Форматы данных',
            prefix: '/ru/data/',
            children: [
              'json-payload',
              'form',
              'files',
              'sse'
            ]
          },
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
            text: 'Продвинутые сценарии',
            prefix: '/ru/advanced/',
            children: [
              'middlewares',
              `compression`,
              `decompression`,
              'errors',
              'di',
              'tracing',
              'static-files',
              `cors`,
              'cancellation',
              'custom-trace-opt-head',
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
