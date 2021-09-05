const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
    title: "OmniHive",
    tagline: "Plug and Play NodeJS Back-End Framework",
    url: "https://www.omnihive.io",
    baseUrl: "/",
    onBrokenLinks: "throw",
    onBrokenMarkdownLinks: "warn",
    favicon: "img/favicon-32x32.png",
    organizationName: "WithOneVisionTechnologies", // Usually your GitHub org/user name.
    projectName: "omnihive", // Usually your repo name.
    themeConfig: {
        navbar: {
            title: "OmniHive",
            logo: {
                alt: "OmniHive Logo",
                src: "img/bee_logo_dark.png",
                srcDark: "img/bee_logo_white.png",
            },
            items: [
                {
                    type: "doc",
                    docId: "getting-started/installation",
                    position: "left",
                    label: "Getting Started",
                },
                { to: "/blog", label: "Blog", position: "left" },
                {
                    href: "https://www.withone.vision",
                    label: "With One Vision Technologies",
                    position: "right",
                },
                {
                    href: "https://github.com/WithOneVisionTechnologies/omnihive",
                    label: "GitHub",
                    position: "right",
                },
            ],
        },
        footer: {
            links: [
                {
                    title: "Back OmniHive",
                    items: [
                        {
                            label: "Patreon",
                            href: "https://www.patreon.com/withonevision?fan_landing=true",
                        },
                        {
                            label: "OpenCollective",
                            href: "https://stackoverflow.com/questions/tagged/docusaurus",
                        },
                        {
                            label: "All Backing Options",
                            to: "/become-backer",
                        },
                    ],
                },
                {
                    title: "Social Media",
                    items: [
                        {
                            label: "YouTube",
                            href: "https://www.youtube.com/channel/UCAvBZ1fRk2V2TEswMgHHd1Q",
                        },
                        {
                            label: "Discord",
                            href: "https://discord.com/channels/869594616524054608/869594616524054610",
                        },
                        {
                            label: "Twitter",
                            href: "https://twitter.com/docusaurus",
                        },
                        {
                            label: "All Social Media",
                            to: "/social-media",
                        },
                    ],
                },
                {
                    title: "More",
                    items: [
                        {
                            label: "Blog",
                            to: "/blog",
                        },
                        {
                            label: "GitHub",
                            href: "https://github.com/WithOneVisionTechnologies/omnihive",
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} With One Vision Technologies.  Built with Docusaurus.`,
        },
        prism: {
            theme: require("prism-react-renderer/themes/okaidia"),
        },
    },
    presets: [
        [
            "@docusaurus/preset-classic",
            {
                docs: {
                    sidebarPath: require.resolve("./sidebars.js"),
                    // Please change this to your repo.
                    editUrl: "https://github.com/WithOneVisionTechnologies/omnihive-web",
                },
                blog: {
                    showReadingTime: true,
                    // Please change this to your repo.
                    editUrl: "https://github.com/WithOneVisionTechnologies/omnihive-web",
                },
                theme: {
                    customCss: require.resolve("./src/css/custom.scss"),
                },
            },
        ],
    ],
    plugins: ["docusaurus-plugin-sass"],
};
