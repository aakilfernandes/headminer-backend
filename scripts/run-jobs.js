const connection = require('../lib/connection')
const child_process = require('child_process')

setInterval(getJobWrapper('parse-twitter-statuses'), 1000)
setInterval(getJobWrapper('scrape-url'), 1000)

function getJobWrapper(name) {
  return function jobWrapper() {
    console.log(`--- START JOB: ${name} ---`)
    return connection.query('INSERT INTO jobs(name) VALUES (?)', [name]).then((result) => {
      const job_id = result.insertId
      const script_path = `${__dirname}/../scripts/${name}.js`
      console.log(script_path)
      child_process.exec(`node ${script_path}`, (err) => {
        if (err) {
          console.log(err)
          connection.query(`UPDATE jobs SET failed_at = NOW() WHERE id = ?`, [job_id])
        } else {
          connection.query(`UPDATE jobs SET succeeded_at = NOW() WHERE id = ?`, [job_id])
        }
      })
    }).then(() => {
      console.log(`--- END JOB: ${name} ---`)
    })
  }
}
