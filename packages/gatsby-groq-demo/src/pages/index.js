import React from 'react';
import { useGroqQuery } from '../../plugins/gatsby-plugin-groq';

import { getWorldsJobs } from '../fragments';



export const groqQuery = `{
  "worlds": *[ internal.type == "worlds" ] {
    _id,
    name,
    "jobs": ${getWorldsJobs}
  }
}`;
const IndexPage = ( { pageContext } ) => {

  const { data } = pageContext;
  const awesomeCharacters = useGroqQuery( `
    *[ internal.type == "characters" ] {
      ...
    }
  ` );

  console.log( 'Worlds', data.worlds );
  console.log( 'Awesome Characters', awesomeCharacters );

  return(

    <div>
      <h1>Try adding a groqQuery export to this page!</h1>
    </div>

  )

}

export default IndexPage
