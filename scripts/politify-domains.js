const connection = require('../lib/connection')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const colors = require('colors')
const prompt = require('prompt')
const Promise = require('bluebird')
const opener = require('opener')

const ask = Promise.promisify(prompt.get)

function next() {
  return connection.query('SELECT id, domain FROM domains WHERE is_political IS NULL ORDER BY reddit_posts_count DESC LIMIT 1').then((domains) => {

    const domain_pojo = domains[0]
    const url = `http://${domain_pojo.domain}`
    const question = `Is ${domain_pojo.domain} political?`

    console.log('\033[2J');
    console.log(domain_pojo.domain.green)
    const chrome = opener(url)
    opener('/Applications/Utilities/Terminal.app')
    setTimeout(() => {
      opener('/Applications/Utilities/Terminal.app')
    }, 1000)

    let is_political

    return request(url, {
      timeout: 5000
    }).then((html) => {
      const parsed_html = parseHtml(html)

      console.log(parsed_html.title || 'No title')
      console.log(parsed_html.description || 'No description')

      prompt.start()

      return ask(question).then((answers) => {
        const answer = answers[question]
        console.log('answer', answer)
        switch (answer) {
          case 'y':
            is_political = true
            break
          case 'n':
            is_political = false
            break;
          default:
            throw new Error(`Invalid answer "${answer}"`)
        }
        console.log('is_political', is_political)

      }).then(() => {
        console.log('then', is_political)
        chrome.unref()
        return connection.query('UPDATE domains SET is_political = ? WHERE id = ?', [
          is_political, domain_pojo.id
        ])
      })
    }, () => {
      return connection.query('UPDATE domains SET is_political = 0 WHERE id = ?', [
        domain_pojo.id
      ])
    }).finally(() => {
      console.log('finally')
      return next()
    })
  })
}

next()
