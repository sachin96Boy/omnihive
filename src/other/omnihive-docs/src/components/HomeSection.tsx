import useThemeContext from "@theme/hooks/useThemeContext";
import React, { useEffect } from "react";

import styles from "../pages/index.module.scss";

export interface HomeSectionProps {
    data: {
        heading: string;
        imgUrl: string;
        darkImgUrl?: string;
    };
    orientation: "left" | "right";
    content: any;
}
export const HomeSection = ({ data, orientation, content }: HomeSectionProps) => {
    const { isDarkTheme } = useThemeContext();

    useEffect(() => {
        if (data.darkImgUrl) {
            console.log(`darkTheme? darkImgUrl`, isDarkTheme + " : " + data.darkImgUrl);
        }
    }, [data.darkImgUrl, isDarkTheme]);

    if (orientation === "left") {
        return (
            <section className={styles.lightBackground}>
                <div className={`container ${styles.containerMd}`}>
                    <div className="row padding-vert--xl">
                        <div className={`col col--8`}>
                            <div className={`padding-right--lg ${styles.sectionContent}`}>
                                <h2 className={`${styles.sectionHeading} margin-top--sm`}>{data.heading}</h2>
                                {content}
                            </div>
                        </div>
                        <div className={`col col--4 ${styles.colBg} ${styles.flexVertCenter}`}>
                            <div
                                className={styles.bgSquare}
                                style={{
                                    backgroundImage:
                                        data.darkImgUrl && isDarkTheme
                                            ? `url(${data.darkImgUrl})`
                                            : `url(${data.imgUrl})`,
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>
        );
    } else if (orientation === "right") {
        return (
            <section>
                <div className={`container ${styles.containerMd}`}>
                    <div className="row padding-vert--xl">
                        <div className={`col col--4 ${styles.colBg}`}>
                            <div
                                className={styles.bgSquare}
                                style={{
                                    backgroundImage:
                                        data.darkImgUrl && isDarkTheme
                                            ? `url(${data.darkImgUrl})`
                                            : `url(${data.imgUrl})`,
                                }}
                            />
                        </div>
                        <div className={`col col--8`}>
                            <div className={`padding-left--lg ${styles.sectionContent}`}>
                                <h2 className={`${styles.sectionHeading} margin-top--sm`}>{data.heading}</h2>
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }
};

export default HomeSection;
