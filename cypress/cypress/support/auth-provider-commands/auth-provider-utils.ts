export const getTopLevelDomain = (url: string): string => {
    const parts = url.split('/');
    // https://<part[2]>/...
    return parts[2];
};
