import React from "react";
import useThemeContext from "@theme/hooks/useThemeContext";

export interface ThemedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    lightimagesource: string;
    darkimagesource: string;
}

const ThemedImage: React.FC<ThemedImageProps> = (props: ThemedImageProps): React.ReactElement => {
    const { isDarkTheme } = useThemeContext();
    return <img src={isDarkTheme ? props.darkimagesource : props.lightimagesource} {...props} />;
};

export default ThemedImage;
