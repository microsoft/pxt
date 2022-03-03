import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as authClient from '../../services/auth';

export type AuthState = {
    signedIn: boolean;
    profile?: pxt.auth.UserProfile;
    tokenStatus: 'initial' | 'pending' | 'authorized' | 'invalid';
};

const initialState: AuthState = {
    signedIn: false,
    tokenStatus: 'initial'
};

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUserProfile: (state, action: PayloadAction<pxt.auth.UserProfile | undefined>) => {
            const signedIn = state.signedIn = !!action.payload?.id;
            if (signedIn) {
                state.profile = action.payload;
            } else {
                state.profile = undefined;
            }
        },
        resetTokenStatus: (state) => {
            state.tokenStatus = 'initial';
        }
    },
    extraReducers: (builder) => {
        builder.addCase(authorizeToken.pending, (state) => {
            state.tokenStatus = 'pending';
        });
        builder.addCase(authorizeToken.fulfilled, (state, { payload }) => {
            state.tokenStatus = payload.result;
        });
        builder.addCase(authorizeToken.rejected, (state) => {
            state.tokenStatus = 'invalid';
        });
    }
});

export const { setUserProfile, resetTokenStatus } = authSlice.actions;
export default authSlice.reducer;

type AuthorizeTokenResult = {
    result: 'authorized' | 'invalid'
};

export const authorizeToken = createAsyncThunk('token/authorize', async (code: string | undefined): Promise<AuthorizeTokenResult> => {
    try {
        const response = await (await authClient.clientAsync())?.apiAsync('/api/otac/authorize', { code });
        return { result: response?.resp.status };
    } catch (e) {
        return { result: 'invalid' };
    }
});
