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
  return connection.query(`
    SELECT * FROM twitter_influencers
    ORDER BY ignorified_at ASC, users_count
    DESC LIMIT 1`
  ).then((influencers) => {
    const influencer = influencers[0]
    return getIsIgnored(influencer).then((is_ignored) => {
      return connection.query('UPDATE twitter_influencers SET ignorified_at = NOW(), is_ignored = ? WHERE id = ?', [
        is_ignored, influencer.id
      ])
    }, () => {
      return connection.query('UPDATE twitter_influencers SET ignorified_at = NOW() WHERE id = ?', [
        influencer.id
      ])
    }).finally(() => {
      return next()
    })
  })
}

function getIsIgnored(influencer) {

  const url = `http://twitter.com/${influencer.screen_name}`
  const question =
  `Is ${influencer.screen_name} (${influencer.name}) ignored? ${influencer.description}`

  console.log('\033[2J');

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
        return getIsIgnored(influencer).then((answer) => {
          chrome.unref()
          return answer
        })
      case 'x':
        process.exit()
      case 's':
        return null
      default:
        return getIsIgnored(influencer)
    }
  })
}

next()
