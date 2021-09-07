/// <reference path="../../declarations.d.ts" />

import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import React from "react";

import HomePageFeature from "../components/HomePageFeature";
import HomeSection, { HomeSectionProps } from "../components/HomeSection";
import styles from "./index.module.scss";

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

const sections: HomeSectionProps[] = [
    {
        data: {
            heading: "Build Anything Now. Seriously.",
            imgUrl: "img/worker-code.png",
        },
        orientation: "left",
        content: (
            <>
                <p>
                    Setting up core backend functionality takes too much time, delaying the building of your project by
                    days or weeks.
                </p>
                <p>Eliminate boilerplate garbage and start building in minutes, not days.</p>
                <p style={{ marginBottom: 0 }}>Out of the box Omnihive gives you</p>
                <div className="row">
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Express.js
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Web socket services
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Security
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Error Handling
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Task Running
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Package Management
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Cluster Awareness
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>A REST Server
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>A Graph Server
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Logging
                        </div>
                    </div>
                    <div className="col col--6">
                        <div className={styles.featureItem}>
                            <span className={styles.featureBullet}>&#9733;</span>Easy Debugging
                        </div>
                    </div>
                </div>
            </>
        ),
    },
    {
        data: {
            heading: "What Plug and Play Means",
            imgUrl: "img/plug-light.png",
            darkImgUrl: "img/plug-dark.png",
        },
        orientation: "right",
        content: (
            <>
                <p>Omnihive provides sensible defaults for many of your backend and middleware needs.</p>
                <p>
                    However, Omnihive's interfaced architecture allows you to easily replace any core worker module with
                    one that works better for you.
                </p>
                <p>If one doesn't already exist that suits your needs, building a new worker is straight forward.</p>
            </>
        ),
    },
    {
        data: {
            heading: "The Power of Workers",
            imgUrl: "img/atom-light.png",
            darkImgUrl: "img/atom-dark.png",
        },
        orientation: "left",
        content: (
            <>
                <p>
                    Omnihive workers encapsulate backend functionality as npm packages, making your code sharable,
                    reusable, and stackable.
                </p>
                <p>
                    A worker could be as simple as a single data query or as complex as managing your realtime chat
                    network.
                </p>
                <p>
                    The power of workers comes from the fact that Omnihive's interfaced architecture allows you to use
                    any other worker, or NPM package, inside any other worker.
                </p>
            </>
        ),
    },

    {
        data: {
            heading: "Blur the lines between backend and frontend",
            imgUrl: "img/send-back-light.png",
            darkImgUrl: "img/send-back-dark.png",
        },
        orientation: "right",
        content: (
            <>
                <p>Your development slows down when your front end developers have to wait on the backend.</p>
                <p>
                    Omnihive's built-in SQL to Graph Translator maps your SQL database to Graph models, empowering your
                    front end team to query for exactly what they need using GraphQL.
                </p>
            </>
        ),
    },
    {
        data: {
            heading: "Battle Tested and Joyful",
            imgUrl: "img/swords-light.png",
            darkImgUrl: "img/swords-dark.png",
        },
        orientation: "left",
        content: (
            <>
                <p>The savvy researcher will notice that our first public release of Omnihive was version 6.0.</p>
                <p>
                    Before releasing Omnihive publically, we used it for 2 years on production projects at With One
                    Vision Technologies.
                </p>
                <p>Omnihive was too much of a joy to keep to ourselves any longer.</p>
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

                {sections.map((item) => (
                    <HomeSection data={item.data} orientation={item.orientation} content={item.content} />
                ))}

                <div className={`${styles.cornerRibbon} ${styles.bottomLeft}`}>In Pre-Alpha!</div>
                <div className={`${styles.cornerRibbon} ${styles.bottomRight}`}>In Pre-Alpha!</div>
            </main>
        </Layout>
    );
};

export default Home;
