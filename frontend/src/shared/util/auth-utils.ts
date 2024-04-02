import { AuthContextProps } from 'react-oidc-context';

export const getUsername = (authContext: AuthContextProps): string => {
    return authContext.user!.profile.preferred_username || '';
};