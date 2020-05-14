const chalk = require( 'chalk' );

/**
 * Custom reporter.
 */
exports.reporter = {
  info: msg => console.log( `${chalk.blue( 'info' )} [groq] ${msg}` ),
  warn: msg => console.warn( `[groq] ${msg}` ),
  success: msg => console.log( `${chalk.green( 'success' )} [groq] ${msg}` ),
  error: msg => console.log( `${chalk.hex( '#730202' ).bold( `${msg} \n` ) }` ),
}
