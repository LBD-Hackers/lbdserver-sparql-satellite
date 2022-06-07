import express from 'express'
import { log } from './logger'
import cors from 'cors'
import { extractWebId } from "express-solid-auth-wrapper"
import { syncResourceAdd, syncResourceDelete, syncResourceUpdate, queryDatabase, getDataset, getAllMirroredResources, createDataset } from "./controller"
import generateFetch from './functions/auth'
import fetch from 'cross-fetch'
import bodyParser from 'body-parser'
const port = process.env.PORT_SPARQL_SATELLITE

const app = express();
app.use(cors())
app.use(express.json());

var options = {
    inflate: true,
    limit: '100kb',
    type: 'application/sparql-update'
  };

app.use(bodyParser.raw(options));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

async function setSatellite(req, res, next) {
    try {
        if (req.auth.webId) {
            const { email, password, idp } = JSON.parse(process.env[req.auth.webId])
            if (email && password) {
                req.fetch = await generateFetch(email, password, idp)
            } else {
                req.fetch = fetch
            }
        } else {
            req.fetch = fetch
        }
        next()
    } catch (error) {
        console.log(`error`, error)
        next(error)
    }
}

// // set satellite authenticated session as req.session
app.use(extractWebId)
app.use(setSatellite)

app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', ['*']);
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

 
app.post('/', createDataset)
app.get('/', (req, res) => {
    res.send('ok') 
})

// dataset query
app.post("/:dataset/sparql", queryDatabase)

// dataset query
app.get("/:dataset/sparql", queryDatabase)

app.patch("/:dataset/sparql", queryDatabase)
app.put("/:dataset", queryDatabase)

// dataset retrieval
app.get("/:dataset/get", getDataset)


// app.post('/filesync', syncFileSystem)
 
// the satellite is notified of a new resource on the Pod
app.post("/:dataset/upload", syncResourceAdd)

// the satellite is notified that a resource has been removed from the Pod
app.delete("/:dataset/delete", syncResourceDelete)

// the satellite is notified a resource on the Pod has been updated
app.patch("/:dataset/upload", syncResourceUpdate)

// get a list of all mirrored resources
app.get('/all', getAllMirroredResources)

app.listen(port, async () => {
    log.info(`Server listening at http://localhost:${port}`);
})