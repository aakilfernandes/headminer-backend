const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const request = require('request-promise')
const parseHtml = require('../lib/parseHtml')
const colors = require('colors')
const prompt = require('prompt')
const Promise = require('bluebird')
const opener = require('opener')

const ask = Promise.promisify(prompt.get)

prompt.start()

function next() {
  return mysqlQuery(`
    SELECT * FROM domains
    WHERE is_ignored = 0 AND publisher_id IS NULL
    ORDER BY reddit_posts_count DESC
    LIMIT 1
  `).then((domain_pojos) => {
    console.log(domain_pojos)
    const domain_pojo = domain_pojos[0]
    return getName(domain_pojo).then((name) => {
      console.log('name', name)
      return mysqlQuery(`
        INSERT IGNORE INTO publishers(name) VALUES (?);
        UPDATE domains SET publisher_id = (SELECT id FROM publishers WHERE name = ? LIMIT 1) WHERE id = ?
      `, [name, name, domain_pojo.id])
    }).then(() => {
      return next()
    })
  })
}

function getName(domain_pojo) {

  const url = `http://${domain_pojo.domain}`
  const question = `What is ${domain_pojo.domain}'s publisher's name?`

  console.log('\033[2J');

  opener('/Applications/Utilities/Terminal.app')
  setTimeout(() => {
    opener('/Applications/Utilities/Terminal.app')
  }, 1000)

  return ask(question).then((answers) => {
    const answer = answers[question]
    switch (answer) {
      case 'c':
        chrome = opener(`https://www.google.com/search?q=${domain_pojo.domain}`)
        return getName(domain_pojo).then((answer) => {
          chrome.unref()
          return answer
        })
      case 'x':
        return mysqlDisconnect()
      default:
        return answer
    }
  })
}

next()
