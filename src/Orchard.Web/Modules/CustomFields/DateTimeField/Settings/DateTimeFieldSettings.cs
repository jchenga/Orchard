using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace CustomFields.DateTimeField.Settings {

    public enum DateTimeFieldDisplays {
        DateAndTime,
        DateOnly,
        TimeOnly
    }

    public class DateTimeFieldSettings {
        public DateTimeFieldDisplays Display { get; set; }
    }
}