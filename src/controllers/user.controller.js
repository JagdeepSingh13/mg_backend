import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found while generating tokens");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // update and save refresh token to database
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation error:", error);
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  console.log("=== REGISTER USER CONTROLLER CALLED ===");
  console.log("Request body:", req.body);
  console.log("Request files:", req.files);
  
  // 1. get user details from frontend or from the user
  const { a_id, email, name, password } = req.body;
  console.log("Extracted fields:", { a_id, email, name, password: password ? "***" : "missing" });

  if ([a_id, email, name, password].some((field) => field?.trim() === "")) {
    console.log("Validation failed: Missing required fields");
    throw new ApiError(400, "All field are required");
  }
  console.log("Field validation passed");

  // 3. check if user already exists: username, email
  console.log("Checking if user already exists...");
  const existedUser = await User.findOne({
    $or: [{ a_id }, { email }],
  });

  if (existedUser) {
    console.log("User already exists:", existedUser.email);
    throw new ApiError(409, "User with email or username already exists");
  }
  console.log("User doesn't exist, proceeding...");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  console.log("Avatar local path:", avatarLocalPath);

  if (!avatarLocalPath) {
    console.log("No avatar file found");
    throw new ApiError(400, "avatar file is required");
  }

  console.log("Uploading avatar to Cloudinary...");
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  console.log("Avatar upload result:", avatar);

  

  console.log("Creating user in database...");
  const user = await User.create({
    a_id,
    avatar: avatar?.url || "",
    email,
    password,
    name: name.toLowerCase(),
  });
  console.log("User created:", user._id);

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    console.log("Failed to fetch created user");
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  console.log("User registration successful:", createdUser);
  
  // Generate tokens for the newly created user
  console.log("Generating tokens for new user...");
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(createdUser._id);
  console.log("Tokens generated successfully");

  // Set cookie options
  const options = {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
  };

  // 9. return response with tokens
  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {
      user: createdUser,
      accessToken,
      refreshToken
    }, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // 1. req.body -> data ( take the input data from the user )
  const { email, a_id, password } = req.body;

  // 2. username or email
  if (!a_id && !email) {
    throw new ApiError(400, "username or email is required");
  }

  // 3. find the user
  const user = await User.findOne({
    $or: [{ a_id }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "user does not exist");
  }

  // 4. password check
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // 5. access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // 6. send cookies
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // we need the users id to get its data and then logout
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

// it is used to generate new Access token by verifying the user's refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
};
