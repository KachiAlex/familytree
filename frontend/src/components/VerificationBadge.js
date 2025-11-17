import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { VerifiedUser as VerifiedIcon, Pending as PendingIcon, Cancel as CancelIcon } from '@mui/icons-material';

const VerificationBadge = ({ status, verifiedBy, verifiedAt, onVerify, canVerify }) => {
  if (status === 'verified') {
    return (
      <Tooltip title={`Verified on ${verifiedAt ? new Date(verifiedAt).toLocaleDateString() : 'unknown date'}`}>
        <Chip
          icon={<VerifiedIcon />}
          label="Verified"
          color="success"
          size="small"
        />
      </Tooltip>
    );
  }

  if (status === 'rejected') {
    return (
      <Chip
        icon={<CancelIcon />}
        label="Rejected"
        color="error"
        size="small"
      />
    );
  }

  // pending
  return (
    <Tooltip title={canVerify ? 'Click to verify' : 'Pending verification'}>
      <Chip
        icon={<PendingIcon />}
        label="Pending"
        color="warning"
        size="small"
        onClick={canVerify ? onVerify : undefined}
        style={{ cursor: canVerify ? 'pointer' : 'default' }}
      />
    </Tooltip>
  );
};

export default VerificationBadge;

