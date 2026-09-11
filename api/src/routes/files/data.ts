import { DBTables } from '../../utils/db.ts';

export const updateAvatar = async (
	database: D1Database,
	profileId: string,
	fileName: string
) => {
	const { success } = await database.prepare(`
		UPDATE ${DBTables.PROFILE}
			SET avatar = ?
			WHERE id = ?
			LIMIT 1
	`)
		.bind(fileName, profileId)
		.run();

	return success;
};
