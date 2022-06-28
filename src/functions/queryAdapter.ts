import { discoverAcls, getAccessRightsAsk } from './accessControl'
import { translate, toSparql } from 'sparqlalgebrajs'
import { querySparql, updateSparql } from './index'

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

    const query: string = validateQuery(q)
    const set = new Set()
    const notAllowed = new Set()

    const results = await querySparql(query, dataset, req.headers.accept)
    results.results.bindings.forEach(item => {
      for (const k of Object.keys(item)) {
        if (k.startsWith("graph_")) {
          set.add(item[k].value)
        }
      }
    })

    for (const resource of Array.from(set)) {
      let aclQuery
      if (actor) {
        aclQuery = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
            
            ASK {?authorization
                  a acl:Authorization ;
                  acl:accessTo <${resource}> ;
                  acl:mode acl:Read .
          {?authorization acl:agent <${actor}> }
          UNION {?authorization acl:agentClass foaf:Agent }
            }`
      } else {
        aclQuery = `PREFIX acl: <http://www.w3.org/ns/auth/acl#>
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
            
            ASK {?authorization
                  a acl:Authorization ;
                  acl:accessTo <${resource}> ;
                  acl:mode acl:Read ;
                  acl:agentClass foaf:Agent .
            }`
      } 

      const can = await querySparql(aclQuery, dataset, "application/sparql-results+json")
      if (!can) {
        notAllowed.add(resource)
      }
    }

    const final = results.results.bindings.map(binding => {
      const original = {}
      for (const key of Object.keys(binding)) {
        if (key.startsWith('graph_')) {
          if (notAllowed.has(binding[key])) {
            return undefined
          }
        } else {
          original[key] = binding[key]
        }
      }
      return original
    })
    // if (Array.from(notAllowed).length > 0) {
    //   // what to do if a resource cannot be seen? Don't send any results or filter them out?

    //   throw new Error("Not allowed to access some of these resources")
    // } else {
      return {head: {vars: results.head.vars.filter(item => !item.includes('graph_'))}, results: final}
    // }
  } catch (error) {
    console.log(`error`, error)
    return new Error(error)
  }
}

function validateQuery(query) {
  const translation = translate(query);
  const newQuery: any = {
    type: "project",
    input: {
      type: "join",
      input: []
    },
    variables: translation.variables
  }
  const { bgp, variables } = findLowerLevel(translation, translation.variables)
  let added = 1
  for (const pattern of bgp.patterns) {
    // ask for named graph
    const graphVar = `graph_${added}`
    const name = {
      termType: "Variable",
      value: graphVar
    }
    const item = {
      type: "graph",
      input: {
        type: "bgp",
        patterns: [pattern],
      },
      name
    }
    newQuery.input.input.push(item)
    newQuery.variables.push(name)

    // ask for ACL
    const aclVar = `acl_${added}`
    const aclVarName = {
      termType: "Variable",
      value: aclVar
    }

    added += 1
  }

  const q = toSparql(newQuery)
  return q
}

function findLowerLevel(obj, variables) {
  if (!variables) variables = obj.variables
  if (obj.type === "bgp") {
    return { bgp: obj, variables }
  } else {
    return findLowerLevel(obj.input, variables)
  }
}