const mysqlQuery = require('../lib/mysqlQuery')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const colors = require('colors')
const prompt = require('prompt')
const Promise = require('bluebird')
const opener = require('opener')

const ask = Promise.promisify(prompt.get)

prompt.start()

function next() {
  return mysqlQuery('SELECT * FROM domains ORDER BY ignorified_at ASC, reddit_posts_count DESC LIMIT 1').then((domain_pojos) => {
    const domain_pojo = domain_pojos[0]
    return getIsIgnored(domain_pojo).then((is_ignored) => {
      return mysqlQuery('UPDATE domains SET ignorified_at = NOW(), is_ignored = ? WHERE id = ?', [
        is_ignored, domain_pojo.id
      ])
    }, () => {
      return mysqlQuery('UPDATE domains SET ignorified_at = NOW() WHERE id = ?', [
        domain_pojo.id
      ])
    }).finally(() => {
      return next()
    })
  })
}

function getIsIgnored(domain_pojo) {

  const url = `http://${domain_pojo.domain}`
  const question = `Is ${domain_pojo.domain} ignored?`

  console.log('\033[2J');
  console.log(`${domain_pojo.domain} (${domain_pojo.reddit_posts_count})`.green)

  opener('/Applications/Utilities/Terminal.app')
  setTimeout(() => {
    opener('/Applications/Utilities/Terminal.app')
  }, 1000)

  return ask(question).then((answers) => {
    const answer = answers[question]
    switch (answer) {
      case 'y':
        return true
        break
      case 'n':
        return false
        break;
      case 'c':
        chrome = opener(url)
        return getIsIgnored(domain_pojo).then((answer) => {
          chrome.unref()
          return answer
        })
      case 'x':
        process.exit()
      case 's':
        return null
      default:
        return getIsIgnored(domain_pojo)
    }
  })
}

next()
