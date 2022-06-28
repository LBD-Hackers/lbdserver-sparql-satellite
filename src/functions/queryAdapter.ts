import { discoverAcls, getAccessRightsAsk } from './accessControl'
import { translate, toSparql} from 'sparqlalgebrajs'
import {querySparql, updateSparql} from './index'

export async function queryPodUnion(req, res) {
    try {
      const actor = req.auth.webId
      const dataset = req.params.dataset
      let q
      if (req.query && req.query.query) {
        q = req.query.query
      } else if (req.body) {
        if (req.body.query) {
          q = req.body.query
        } else {
          try {
            q = Buffer.from(req.body).toString("utf8")
          } catch (error) {
            console.log('error', error)
          }
        }
      }

      // const { query, graphVariable, from }: any = validateQuery(q)
      // console.log('query', query)
      let response
      if (q && !q.includes('INSERT')) {
        response = await querySparql(q, dataset)
      } else {
        response = await updateSparql(q, dataset)
      }

      // let bindings = []

      // // if it's not the owner of the pod: check acls 
      // if (!actor === req.session.info.webId) {
      //   if (from) {
      //       const { acl } = await discoverAcls(from, req.session)
      //       if (actor) {
      //         for (const w of Object.keys(acl)) {
      //           const allowed = await getAccessRightsAsk(w, actor, ["http://www.w3.org/ns/auth/acl#Read"], req.session)
      //           if (!allowed) {
      //             throw new Error("You do not have access to one or more of the indicated named graphs")
      //           }
      //         }
      //       }
      //       bindings = response.results.bindings
      //     } else {
      //       const included = new Set(response.results.bindings.map(i => i[graphVariable].value))
      //       const { acl, open } = await discoverAcls(included, req.session)
      //       let allowedToQuery = open
      //       if (actor) {
      //         for (const w of Object.keys(acl)) {
      //           const allowed = await getAccessRightsAsk(w, actor, ["http://www.w3.org/ns/auth/acl#Read"], req.session)
      //           if (allowed) {
      //             allowedToQuery = [...allowedToQuery, ...acl[w]]
      //           }
      //         }
      //       }
      //       for (const binding of response.results.bindings) {
      //         const graph = binding[graphVariable].value
      //         if (allowedToQuery.includes(graph)) {
      //           bindings.push(binding)
      //         }
      //       }
      //     }

      //     return { head: response.head, results: { bindings } }

      // } else {
        return response
      // }

      } catch (error) {
      console.log(`error`, error)
      res.status(400).send(error)
    }
  }
  
function validateQuery(query) {
    const translation = translate(query, { quads: true });
    if (translation.type === "from") {
      let from
      if (translation.default.length > 0) from = translation.default.map(i => i.value)
      if (translation.named.length > 0 ) from = translation.named.map(i => i.value)
      return {query, from}
    } else {
      const graphVariable = "source"
      console.log('translation', JSON.stringify(translation, undefined, 4))
      const {bgp, variables} = findLowerLevel(translation, translation.variables)
      const graphVar = { termType: 'Variable', value: graphVariable }
      const theQ: any  = {type: "project", input: {type: "graph", input: bgp, name: graphVar }, variables: [...variables, graphVar]}
      const newQuery = toSparql(theQ)
      return {query: newQuery, from: undefined, graphVariable}
    }

    function findLowerLevel(obj, variables?) {
      if (!variables) variables = obj.variables
      if (obj.type === "bgp") { 
          return {bgp: obj, variables}
      } else {
          return findLowerLevel(obj.input, variables)
      }    
    }
  }