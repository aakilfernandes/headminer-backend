const twitter = require('../lib/twitter')
const connection = require('../lib/connection')
const fs = require('../lib/fs')
const _ = require('lodash')

const workDirPath = `${__dirname}/../workspace/twitterStatuses/`
console.log('start stream')

connection.query('SELECT * FROM publisher_hostnames').then((hostnamePojos) => {
  const keywords = hostnamePojos.map((hostnamePojo) => {
    return hostnamePojo.hostname.split('.').join(' ')
  })

  const stream = twitter.stream('statuses/filter', { track: keywords.join(',') })
  stream.on('data', function(twitter_status) {
    if (!twitter_status) {
      return
    }
    const is_status_valid = _.conforms(twitter_status, {
      contributors: _.isObject,
      id_str: _.isString,
      text: _.isString
    })
    const is_user_valid = _.conforms(twitter_status.user, {
      id_str: _.isString
    })
    if (!is_status_valid || !is_user_valid) {
      return
    }
    const id = twitter_status.id_str
    console.log(id)
    fs.writeFileAsync(`${workDirPath}${id}.json`, JSON.stringify(twitter_status, null, 2)).then(() => {
      connection.query('INSERT INTO twitter_statuses(id, created_at, user_id) VALUES(?, ?, ?)', [
        id,
        new Date(twitter_status.created_at),
        twitter_status.user.id_str
      ])
    })
  });

  stream.on('error', function(error) {
    throw error;
  });

})
