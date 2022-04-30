require("dotenv").config({
    path: __dirname + `/.env`,
});

const needle = require("needle");
const express = require("express");
const path = require("path");
const { cp } = require("fs");
const app = express();
const port = 3000;

const server = require("http").Server(app);
const io = require("socket.io")(server);

let tout = null;

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/html/index.html"));
});

app.get("/display", (req, res) => {
    res.sendFile(path.join(__dirname, "/html/displayer/index.html"));
});

app.get("/display/valo", (req, res) => {
    res.sendFile(path.join(__dirname, "/html/displayer/valo.html"));
});

app.use("/static", express.static(__dirname + "/public"));

io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("tweet", async (msg) => {
        const params = { ids: msg, "tweet.fields": getTweetField() };
        const headers = getHeaders();

        const res = await needle("get", getTweetsApiUrl(msg.id), params, {
            headers,
        });

        if (res.body && res.body.data && res.body.data[0]) {
            const paramsAuthor = { "user.fields": getAuthorField() };

            const author = await needle(
                "get",
                getAuthorApiUrl(res.body.data[0].author_id),
                paramsAuthor,
                {
                    headers,
                }
            );

            if (author.body) {
                const tweet = res.body.data[0];
                const tauthor = author.body.data;
                const obj = new Tweet(tweet, tauthor);
                socket.broadcast.emit("tweet", obj);

                if (tout) {
                    clearTimeout(tout);
                }

                tout = setTimeout(() => {
                    socket.broadcast.emit("off_tweet");
                }, 60000);
            }
        }
    });

    socket.on("tweet_off", async (msg) => {
        console.log(msg);
        if (tout) {
            clearTimeout(tout);
        }

        socket.broadcast.emit("off_tweet");
    });
});

server.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

function getHeaders() {
    return {
        authorization: `Bearer ${process.env.BEARER_TOKEN}`,
    };
}

function getTweetsApiUrl() {
    return `https://api.twitter.com/2/tweets`;
}

function getAuthorApiUrl(authorId) {
    return `https://api.twitter.com/2/users/${authorId}`;
}

function getTweetField() {
    return "author_id";
}

function getAuthorField() {
    return "name,username,verified,profile_image_url";
}

class Tweet {
    constructor(tweet, author) {
        this.id = tweet.id;
        this.authorId = tweet.author_id;
        this.message = tweet.text;
        this.username = author.name;
        this.userAt = author.username;
        this.ppUrl = author.profile_image_url;
    }
}
