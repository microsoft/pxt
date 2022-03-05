import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as authClient from '../../services/auth';

const enum Status {
    INITIAL = 'initial',
    PENDING = 'pending',
    AUTHORIZED = 'authorized',
    INVALID = 'invalid'
}

export type AuthState = {
    signedIn: boolean;
    profile?: pxt.auth.UserProfile;
    tokenStatus: Status;
};

const initialState: AuthState = {
    signedIn: false,
    tokenStatus: Status.INITIAL
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
            state.tokenStatus = Status.INITIAL;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(authorizeToken.pending, (state) => {
            state.tokenStatus = Status.PENDING;
        });
        builder.addCase(authorizeToken.fulfilled, (state, { payload }) => {
            state.tokenStatus = payload.result;
        });
        builder.addCase(authorizeToken.rejected, (state) => {
            state.tokenStatus = Status.INVALID;
        });
    }
});

export const { setUserProfile, resetTokenStatus } = authSlice.actions;
export default authSlice.reducer;

type AuthorizeTokenResult = {
    result: Status.AUTHORIZED | Status.INVALID
};

export const authorizeToken = createAsyncThunk('token/authorize', async (code: string | undefined): Promise<AuthorizeTokenResult> => {
    try {
        const response = await (await authClient.clientAsync())?.apiAsync('/api/otac/authorize', { code });
        return { result: response?.resp.status };
    } catch (e) {
        return { result: Status.INVALID };
    }
});
