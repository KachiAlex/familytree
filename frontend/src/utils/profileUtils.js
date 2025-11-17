/**
 * Check if a user profile is complete
 * A profile is considered complete if it has essential fields filled in
 */
export const isProfileComplete = (user) => {
  if (!user) return false;

  // Essential fields for profile completion
  const requiredFields = {
    full_name: user.full_name && user.full_name.trim().length > 0,
    email: user.email && user.email.trim().length > 0,
  };

  // Optional but recommended fields (we'll prompt for these)
  const recommendedFields = {
    date_of_birth: !!user.date_of_birth,
    gender: !!user.gender,
    place_of_birth: !!user.place_of_birth,
  };

  // Profile is complete if all required fields are present
  const hasRequiredFields = Object.values(requiredFields).every((field) => field === true);

  // Calculate completion percentage
  const allFields = { ...requiredFields, ...recommendedFields };
  const completedFields = Object.values(allFields).filter((field) => field === true).length;
  const completionPercentage = (completedFields / Object.keys(allFields).length) * 100;

  return {
    isComplete: hasRequiredFields,
    completionPercentage: Math.round(completionPercentage),
    missingRequired: Object.keys(requiredFields).filter((key) => !requiredFields[key]),
    missingRecommended: Object.keys(recommendedFields).filter((key) => !recommendedFields[key]),
  };
};

