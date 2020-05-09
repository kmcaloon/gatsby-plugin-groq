import React from 'react';

import { demoFunction, demoString } from '../fragments';


export const groqQuery = `
  *[ _type == "post" && _id == $_id ] {
    ...
  }[0]
`;
export const Page = ( { pageContext } ) => {

  const { data } = pageContext;

  console.log( data );

  return(

    <div>
      <h1>Try to add a groqQuery export to this page!</h1>
    </div>
  )

}
export default Page;