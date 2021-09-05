/// <reference path="../../declarations.d.ts" />

import React from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./index.module.scss";
import HomePageFeature from "../components/HomePageFeature";

interface FeatureData {
    title: string;
    lightImageSource: string;
    darkImageSource: string;
    description: React.ReactElement;
}

const features: FeatureData[] = [
    {
        title: "Modular Workers",
        lightImageSource: "img/cube-light.png",
        darkImageSource: "img/cube-dark.png",
        description: (
            <>
                Workers in OmniHive are regular NPM packages with a bit of extra interface framing so that they are
                aware of each other and can be stacked however you like. Build your back-end to your specification in a
                very unopinionated way. Workers can encapsulate as much or as little logic as you want. Microservices or
                monolith...it's your choice.
            </>
        ),
    },
    {
        title: "Fully Extensible",
        lightImageSource: "img/expand-light.png",
        darkImageSource: "img/expand-dark.png",
        description: (
            <>
                You have the power of NodeJS, ExpressJS, TypeScript, and NPM at your disposal. Workers have the ability
                to load other workers or any other package in any NPM registry dynamically. You can build a worker as
                simple as handling one REST call or as complex as our{" "}
                <a href="/docs/workers/server-worker">Express Default Server Worker</a> that reverse-engineers your
                existing databases into fully-formed GraphQL dynamic query engines.
            </>
        ),
    },
    {
        title: "Less Boilerplate",
        lightImageSource: "img/settings-light.png",
        darkImageSource: "img/settings-dark.png",
        description: (
            <>
                Back-End systems always require a lot of "startup boilerplate". Tokens, security, HTTP method handlers,
                caching...it's all the same every time. OmniHive does the vast majority of that setup for you with
                pre-defined workers which you can customize or replace to your specific needs so you can get to coding
                faster.
            </>
        ),
    },
    {
        title: "Scalability Built-In",
        lightImageSource: "img/scale-light.png",
        darkImageSource: "img/scale-dark.png",
        description: (
            <>
                Host and run OmniHive however you like. Download a ZIP file to a file system, run from NPM/Yarn global,
                run as a Docker image, run inside Kubernetes...anything you like. Cluster-aware settings allow you to
                run behind any kind of load-balancing system.
            </>
        ),
    },
    {
        title: "Built For Developers",
        lightImageSource: "img/code-light.png",
        darkImageSource: "img/code-dark.png",
        description: (
            <>
                Run a full version of OmniHive on your local box and develop the way you expect...full debugging with
                breakpoints at the server level. No need for special packaging or complicated "hosted serverless"
                setups. You can even manage your code deployment to your remote OmniHive server instances via the
                provided{" "}
                <a href="https://marketplace.visualstudio.com/items?itemName=with-one-vision.omnihive-server-manager">
                    VS Code extension
                </a>{" "}
                in order to never leave your IDE.
            </>
        ),
    },
    {
        title: "Ready-To-Go Library",
        lightImageSource: "img/book-light.png",
        darkImageSource: "img/book-dark.png",
        description: (
            <>
                Although you can design every worker from scratch if you like, OmniHive comes with a pre-built library
                of workers to help you get started. These includes database workers to connect to MySQL, Postgres,
                MSSQL, or SQLite, cache workers for NodeCache or REDIS, our own custom{" "}
                <a href="/docs/workers/server-worker">Graph to SQL translator</a>, and more!
            </>
        ),
    },
];

const Home: React.FC = (): React.ReactElement => {
    const context = useDocusaurusContext();
    const { siteConfig = {} } = context;
    return (
        <Layout title={`${siteConfig.title}`} description="OmniHive Documentation Home">
            <header className={`hero hero--primary ${styles.heroBanner}`}>
                <div className="container">
                    <h1 className={`hero__title ${styles.ohTitle}`}>
                        <img className={styles.heroBee} src="/img/omnihive-bee.png" alt="bee" />
                        {siteConfig.title}
                    </h1>
                    <p className={`hero__subtitle ${styles.ohSubtitle}`}>{siteConfig.tagline}</p>
                    <div className={styles.buttons}>
                        <a className={`button button--outline button--lg ${styles.getStarted}`} href="/docs">
                            Get Started
                        </a>
                    </div>
                </div>
            </header>
            <main>
                <section className={styles.features}>
                    <div className="container">
                        <div className={`row ${styles.rowJustified}`}>
                            {features.map((props, idx) => (
                                <HomePageFeature key={idx} {...props} />
                            ))}
                        </div>
                    </div>
                </section>
                <div className={`${styles.cornerRibbon} ${styles.bottomLeft}`}>In Pre-Alpha!</div>
                <div className={`${styles.cornerRibbon} ${styles.bottomRight}`}>In Pre-Alpha!</div>
            </main>
        </Layout>
    );
};

export default Home;
