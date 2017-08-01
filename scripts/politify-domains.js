const connection = require('../lib/connection')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const colors = require('colors')
const prompt = require('prompt')
const Promise = require('bluebird')
const opener = require('opener')

const ask = Promise.promisify(prompt.get)

prompt.start()

function next() {
  return connection.query('SELECT id, domain FROM domains ORDER BY politified_at ASC, reddit_posts_count DESC LIMIT 1').then((domain_pojos) => {
    const domain_pojo = domain_pojos[0]
    return getIsPolitical(domain_pojo).then((is_political) => {
      console.log('is_political', is_political)
      return connection.query('UPDATE domains SET politified_at = NOW(), is_political = ? WHERE id = ?', [
        is_political, domain_pojo.id
      ])
    }, () => {
      return connection.query('UPDATE domains SET politified_at = NOW() WHERE id = ?', [
        domain_pojo.id
      ])
    }).finally(() => {
      return next()
    })
  })
}

function getIsPolitical(domain_pojo) {

  const url = `http://${domain_pojo.domain}`
  const question = `Is ${domain_pojo.domain} political?`

  console.log('\033[2J');
  console.log(domain_pojo.domain.green)

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
        return getIsPolitical(domain_pojo).then((answer) => {
          chrome.unref()
          return answer
        })
      case 'x':
        process.exit()
      default:
        throw new Error(`Invalid answer "${answer}"`)
    }
  })
}

next()
