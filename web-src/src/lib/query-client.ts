import { QueryClient, QueryCache } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) => {
				// eslint-disable-next-line no-console
				if (import.meta.env.DEV) console.log({ failureCount, error });

				if (failureCount >= 0 && import.meta.env.DEV) return false;
				if (failureCount > 3 && import.meta.env.PROD) return false;

				return !(
					error instanceof AxiosError &&
					[401, 403].includes(error.response?.status ?? 0)
				);
			},
			refetchOnWindowFocus: import.meta.env.PROD,
			staleTime: 10 * 1000, // 10s
		},
		mutations: {
			onError: (error) => {
				handleServerError(error);

				if (error instanceof AxiosError) {
					if (error.response?.status === 304) {
						toast.error("Content not modified!");
					}
				}
			},
		},
	},
	queryCache: new QueryCache({
		onError: (error) => {
			if (error instanceof AxiosError) {
				if (error.response?.status === 401) {
					toast.error("Session expired!");
					const redirect = `${window.location.href}`;
					window.location.href = `/login?redirect=${redirect}`;
				}
				// if (error.response?.status === 500) {
				// 	toast.error("Internal Server Error!");
				// 	window.location.href = "/500";
				// }
				// if (error.response?.status === 403) {
				// 	window.location.href = "/forbidden";
				// }
			}
		},
	}),
});




function handleServerError(error: unknown) {
	// eslint-disable-next-line no-console
	console.log(error);

	let errMsg = "Something went wrong!";

	if (
		error &&
		typeof error === "object" &&
		"status" in error &&
		Number(error.status) === 204
	) {
		errMsg = "Content not found.";
	}

	if (error instanceof AxiosError) {
		errMsg = error.response?.data.title;
	}

	toast.error(errMsg);
}
