# GPT AI Assistant

<div align="center">

[![license](https://img.shields.io/pypi/l/ansicolortags.svg)](LICENSE) [![Release](https://img.shields.io/github/release/memochou1993/gpt-ai-assistant)](https://GitHub.com/memochou1993/gpt-ai-assistant/releases/)

</div>

GPT AI Assistant is an application that is implemented using the OpenAI API and LINE Messaging API. Through the installation process, you can start chatting with your own AI assistant using the LINE mobile app.

## News

- GPT AI Assistant v4 now support `gpt-3.5-turbo` language model. :fire:

## Demo

<img src="/demo/labot.png" width="300"/>

## Documentations

- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/" target="_blank">中文</a>
- <a href="https://memochou1993.github.io/gpt-ai-assistant-docs/en" target="_blank">English</a>

## Credits

- [jayer95](https://github.com/jayer95) - Debugging and testing
- [kkdai](https://github.com/kkdai) - Idea of "sum" command
- [Dayu0815](https://github.com/Dayu0815) - Idea of "search" command
- [All other contributors](https://github.com/memochou1993/gpt-ai-assistant/graphs/contributors)

## Contact

If there is any question, please contact me at memochou1993@gmail.com. Thank you.

## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/memochou1993/gpt-ai-assistant/releases).

## Taiwan Stock Analysis

The LINE webhook can return a short link to a Taiwan stock analysis dashboard.
Supported message formats include:

```text
2330
股票 台積電
stock: 2317
鴻海 股票分析
```

Vercel only resolves the stock and writes a small request file to the
`Lucaskk/daily-news` repository. A Mac scheduler runs the Python analysis,
publishes static HTML to GitHub Pages, and preserves the previous successful
page if a data source is temporarily unavailable.

Vercel automatically supplies `VERCEL_URL` for the LINE reply link. To use a
stable custom or production domain, set this optional environment variable:

```text
STOCK_ANALYSIS_BASE_URL=https://lucaskk.github.io/daily-news/wiki/stocks/pending.html
STOCK_REQUEST_GITHUB_TOKEN=github_pat_with_contents_write_access
STOCK_REQUEST_REPOSITORY=Lucaskk/daily-news
STOCK_REQUEST_BRANCH=main
STOCK_REQUEST_QUEUE_PATH=wiki/stocks/requests
```

## License

[MIT](LICENSE)
