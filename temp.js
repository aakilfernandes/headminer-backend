const getTwitterStatuses = require('./lib/getTwitterStatuses')

getTwitterStatuses('http://google.com').then((statuses) => {
  console.log(statuses)
})
