---
title: Why We Built Omnihive
---

Omnihive didn't start as a framework. It started because we wanted to make it easy for frontend developers to query SQL databases with the ease of GraphQL. So we built a structure for SQL to Graph translation. The more we worked on and with Omnihive we realized that the underlying structure was even more special than the SQL to Graph translation. With the right kind of love, it would allow us to build anything we wanted.

The magic was realizing that everything in Omnihive is a worker. 

SQL to Graph translation = worker
API Aggregator = worker
REST Server = worker
Task Runner = worker
PubSub Service = worker


