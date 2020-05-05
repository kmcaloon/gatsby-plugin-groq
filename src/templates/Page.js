// import React from 'react';
// import { useGroqQuery } from '../../plugins/gatsby-plugin-groq';
//
//
// export const groqQuery = `{
//   "page": *[ _type == "page" && _id == $_id ] {
//     slug,
//     title,
//   }[0]
// }`;
// export const Page = ( { pageContext } ) => {
//
//   // const page = pageContext;
//   //dfdfd
//   // console.log( page );
//   // console.log( data );
//   const { page } = pageContext.data;
//   console.log( pageContext.data.page );
//   // const groqQuery = useGroqQuery( `{
//   //   "something": *[ _type == "page" ] {
//   //     ...,
//   //     title,
//   //   }[0]
//   // }` );
//
//   return(
//
//     <div>
//       <h1>{ page.title }</h1>
//     </div>
//   )
//
// }
// export default Page;