/// <reference path="../../declarations.d.ts" />

import useBaseUrl from "@docusaurus/useBaseUrl";
import React from "react";

import styles from "./HomePageFeature.module.scss";
import { ThemedImage } from "./ThemedImage";

export interface HomePageFeatureProps {
    lightImageSource: string;
    darkImageSource: string;
    title: string;
    description: React.ReactElement;
}

export const HomePageFeature: React.FC<HomePageFeatureProps> = ({
    lightImageSource,
    darkImageSource,
    title,
    description,
}): React.ReactElement => {
    const lightImage = useBaseUrl(lightImageSource);
    const darkImage = useBaseUrl(darkImageSource);

    return (
        <div className={`col col--4 margin-vert--lg padding-horiz--lg ${styles.feature}`}>
            <div className="text--center">
                <ThemedImage
                    className={`${styles.featureImage}`}
                    lightimagesource={lightImage}
                    darkimagesource={darkImage}
                    alt={title}
                />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
};
